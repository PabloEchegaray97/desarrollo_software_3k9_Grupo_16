/**
 * Soporte de las pruebas de integración de C-06 (no es una suite).
 * El sufijo `.support-spec.ts` no coincide con `*.spec.ts` ni con `*.integration-spec.ts`.
 *
 * - MariaDB real (`TEST_DATABASE_*`); nunca SQLite ni base en memoria. La conexión de
 *   aplicación se construye con `timezone: 'Z'` (CR-05-01), sin reemplazar el DataSource.
 * - Solo se reemplazan el reloj (fijo) y el escritor de turnos (para simular fallos del
 *   historial con atomicidad real de InnoDB).
 * - Los fixtures son exclusivamente ficticios. En `afterAll` se borran eventos, luego
 *   turnos y recién después pacientes/catálogos: la FK `RESTRICT` lo exige.
 */
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { EntityManager } from 'typeorm';
import { DataSource } from 'typeorm';
import { authenticatedCookie } from '../../../auth/testing/session-test.support-spec.js';
import { createTestDataSource } from '../../../../database/data-source.js';
import { APPOINTMENT_CLOCK, FixedClock } from '../../core/clock.js';
import { AppointmentWriter, type NewAppointmentEvent } from '../../core/database/appointment-writer.js';

/** Reloj anterior a cualquier fecha de fixture; ninguna operación ve "pasado" por defecto. */
export const LIFECYCLE_TEST_NOW = new Date('2027-03-01T12:00:00.000Z');

/** Escritor que puede fallar al insertar eventos, después de actualizar el turno. */
export class ControllableLifecycleEventWriter extends AppointmentWriter {
  failNextEvents = false;

  override async insertEvents(manager: EntityManager, events: readonly NewAppointmentEvent[]): Promise<void> {
    if (this.failNextEvents) {
      this.failNextEvents = false;
      throw new Error('Simulated lifecycle history write failure');
    }
    await super.insertEvents(manager, events);
  }
}

export interface LifecycleApiContext {
  app: INestApplication<App>;
  /** Conexión aparte para preparar datos y leer valores literales de la base. */
  db: DataSource;
  sessionCookie: string;
  clock: FixedClock;
  writer: ControllableLifecycleEventWriter;
}

export interface LifecycleFixtures {
  patientId: string;
  procedureId: string;
  procedureWithIntervalId: string;
  chair1Id: string;
  chair2Id: string;
  inactiveChairId: string;
}

export async function startLifecycleApi(): Promise<LifecycleApiContext> {
  const db = createTestDataSource(process.env);
  await db.initialize();
  await db.runMigrations({ transaction: 'all' });
  await cleanupLifecycleData(db);
  const sessionCookie = await authenticatedCookie(db);

  Object.assign(process.env, {
    APP_ENV: 'test',
    BACKEND_PORT: '3000',
    FRONTEND_ORIGIN: 'http://localhost:5173',
    APP_TIME_ZONE: 'America/Argentina/Buenos_Aires',
    DATABASE_HOST: process.env.TEST_DATABASE_HOST,
    DATABASE_PORT: process.env.TEST_DATABASE_PORT,
    DATABASE_NAME: process.env.TEST_DATABASE_NAME,
    DATABASE_USER: process.env.TEST_DATABASE_USER,
    DATABASE_PASSWORD: process.env.TEST_DATABASE_PASSWORD,
    AUTH_SECRET: 'fictional-integration-secret-at-least-32-characters',
  });

  const clock = new FixedClock(LIFECYCLE_TEST_NOW);
  const writer = new ControllableLifecycleEventWriter();
  const { AppModule } = await import('../../../../app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APPOINTMENT_CLOCK)
    .useValue(clock)
    .overrideProvider(AppointmentWriter)
    .useValue(writer)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.init();
  return { app, db, sessionCookie, clock, writer };
}

export async function stopLifecycleApi(context: LifecycleApiContext | undefined): Promise<void> {
  if (!context) return;
  await cleanupLifecycleData(context.db);
  await context.app.close();
  if (context.db.isInitialized) await context.db.destroy();
}

/** Eventos → turnos → excepciones → catálogos: el orden respeta todas las FK `RESTRICT`. */
export async function cleanupLifecycleData(db: DataSource): Promise<void> {
  await db.query('DELETE FROM appointment_events');
  await db.query('DELETE FROM appointments');
  await db.query('DELETE FROM excepcion_disponibilidad');
  await db.query('DELETE FROM disponibilidad_semanal');
  await db.query(
    "UPDATE configuracion_agenda SET intervalo_global_minutos = 10 WHERE id = '00000000-0000-4000-8000-000000000001'",
  );
  await db.query("DELETE FROM patients WHERE name LIKE 'Paciente Ficticio C06%'");
  await db.query("DELETE FROM procedures WHERE name LIKE 'Prestación ficticia C06%'");
  await db.query("DELETE FROM chairs WHERE name LIKE 'Sillón ficticio C06%'");
}

export function api(context: LifecycleApiContext) {
  const server = context.app.getHttpServer();
  const withSession = (method: 'get' | 'post' | 'put' | 'patch') =>
    (path: string, body: object = {}): request.Test =>
      request(server)[method](`/api${path}`).set('Cookie', context.sessionCookie).send(body);
  return {
    get: withSession('get'),
    post: withSession('post'),
    put: withSession('put'),
    patch: withSession('patch'),
    anonymousPatch: (path: string, body: object) => request(server).patch(`/api${path}`).send(body),
    anonymousGet: (path: string) => request(server).get(`/api${path}`),
  };
}

/** Crea referencias por API y deja el miércoles 09:00–13:00 local disponible. */
export async function seedLifecycleFixtures(context: LifecycleApiContext): Promise<LifecycleFixtures> {
  const http = api(context);
  const created = async (path: string, body: object): Promise<string> => {
    const response = await http.post(path, body);
    if (response.status !== 201) throw new Error(`Fixture ${path} failed: ${response.status} ${JSON.stringify(response.body)}`);
    return (response.body as { id: string }).id;
  };
  const fixtures: LifecycleFixtures = {
    patientId: await created('/pacientes', {
      nombre: 'Paciente Ficticio C06 Uno',
      telefono: '11 5555-0601',
      confirmarPosibleDuplicado: true,
    }),
    procedureId: await created('/prestaciones', {
      nombre: 'Prestación ficticia C06 sin intervalo',
      duracionPredeterminadaMinutos: 30,
    }),
    procedureWithIntervalId: await created('/prestaciones', {
      nombre: 'Prestación ficticia C06 con intervalo',
      duracionPredeterminadaMinutos: 30,
      intervaloPosteriorMinutos: 5,
    }),
    chair1Id: await created('/sillones', { nombre: 'Sillón ficticio C06 A' }),
    chair2Id: await created('/sillones', { nombre: 'Sillón ficticio C06 B' }),
    inactiveChairId: await created('/sillones', { nombre: 'Sillón ficticio C06 Inactivo' }),
  };
  const weekly = await http.put('/disponibilidad/semanales', {
    tramos: [{ diaSemana: 3, horaInicio: '09:00', horaFin: '13:00' }],
  });
  if (weekly.status !== 200) throw new Error(`Weekly availability failed: ${weekly.status}`);
  const deactivated = await http.patch(`/sillones/${fixtures.inactiveChairId}/estado`, { activo: false });
  if (deactivated.status !== 200) throw new Error(`Inactive chair fixture failed: ${deactivated.status}`);
  return fixtures;
}

/** Solo turnos y eventos; conserva los fixtures y la disponibilidad entre pruebas. */
export async function clearLifecycleAppointments(db: DataSource): Promise<void> {
  await db.query('DELETE FROM appointment_events');
  await db.query('DELETE FROM appointments');
}

/** Valor literal guardado en MariaDB, sin conversión del driver. */
export async function storedStartsAt(db: DataSource, id: string): Promise<string> {
  const rows = (await db.query("SELECT DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS value FROM appointments WHERE id = ?", [id])) as Array<{
    value: string;
  }>;
  return rows[0]?.value ?? '';
}

/** Conteos globales para detectar eventos huérfanos o turnos creados por una transacción fallida. */
export async function countAppointments(db: DataSource): Promise<number> {
  const rows = (await db.query('SELECT COUNT(*) AS total FROM appointments')) as Array<{ total: string }>;
  return Number(rows[0]?.total);
}

export async function countAppointmentEvents(db: DataSource): Promise<number> {
  const rows = (await db.query('SELECT COUNT(*) AS total FROM appointment_events')) as Array<{ total: string }>;
  return Number(rows[0]?.total);
}

export interface StoredAppointmentRow {
  status: string;
  startsAt: string;
  careEndsAt: string;
  blockEndsAt: string;
  chairId: string;
  durationMinutes: number;
  postIntervalMinutes: number;
  outsideAvailability: number;
  exceptionReason: string | null;
  cancellationReason: string | null;
}

export interface StoredEventRow {
  type: string;
  previousStatus: string | null;
  newStatus: string | null;
  previousStartsAt: string | null;
  newStartsAt: string | null;
  previousChairId: string | null;
  newChairId: string | null;
  reason: string | null;
  occurredAt: string;
}

/** Columnas literales del turno, sin pasar por el mapper de la aplicación. */
export async function storedAppointmentRow(db: DataSource, id: string): Promise<StoredAppointmentRow> {
  const rows = (await db.query(
    `SELECT status,
            DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS startsAt,
            DATE_FORMAT(care_ends_at, '%Y-%m-%d %H:%i:%s') AS careEndsAt,
            DATE_FORMAT(block_ends_at, '%Y-%m-%d %H:%i:%s') AS blockEndsAt,
            chair_id AS chairId,
            duration_minutes AS durationMinutes,
            post_interval_minutes AS postIntervalMinutes,
            outside_availability AS outsideAvailability,
            exception_reason AS exceptionReason,
            cancellation_reason AS cancellationReason
       FROM appointments WHERE id = ?`,
    [id],
  )) as StoredAppointmentRow[];
  if (!rows[0]) throw new Error(`Appointment row not found: ${id}`);
  return rows[0];
}

/** IDs en el orden exacto del contrato, leídos de la base para comparar con la API. */
export async function storedEventIdsInOrder(db: DataSource, appointmentId: string): Promise<string[]> {
  const rows = (await db.query(
    'SELECT id FROM appointment_events WHERE appointment_id = ? ORDER BY occurred_at ASC, id ASC',
    [appointmentId],
  )) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

/** Historial literal ordenado como el contrato: `occurred_at ASC, id ASC`. */
export async function storedEventRows(db: DataSource, appointmentId: string): Promise<StoredEventRow[]> {
  return (await db.query(
    `SELECT type,
            previous_status AS previousStatus,
            new_status AS newStatus,
            DATE_FORMAT(previous_starts_at, '%Y-%m-%d %H:%i:%s') AS previousStartsAt,
            DATE_FORMAT(new_starts_at, '%Y-%m-%d %H:%i:%s') AS newStartsAt,
            previous_chair_id AS previousChairId,
            new_chair_id AS newChairId,
            reason,
            DATE_FORMAT(occurred_at, '%Y-%m-%d %H:%i:%s') AS occurredAt
       FROM appointment_events WHERE appointment_id = ? ORDER BY occurred_at ASC, id ASC`,
    [appointmentId],
  )) as StoredEventRow[];
}
