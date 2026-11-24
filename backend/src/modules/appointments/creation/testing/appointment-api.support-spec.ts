/**
 * Soporte de las pruebas de integración de C-05 (no es una suite).
 * El sufijo `.support-spec.ts` no coincide con `*.spec.ts` ni con `*.integration-spec.ts`.
 *
 * - MariaDB real (`TEST_DATABASE_*`); nunca SQLite ni base en memoria.
 * - NO reemplaza el `DataSource` de la aplicación: prueba la conexión de producción,
 *   incluida su configuración de zona horaria (ver CR-05-01).
 * - Solo reemplaza el reloj (fijo) y el escritor de turnos (para simular fallos del historial).
 * - La suite de C-05 corre primera en el runner: `cleanupC05Data` debe ejecutarse en `afterAll`
 *   porque la FK `RESTRICT` de `appointments` impediría la limpieza de pacientes y catálogos de C-02.
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

/** Reloj de todas las pruebas: anterior a cualquier fecha de fixture. */
export const TEST_NOW = new Date('2027-03-01T12:00:00.000Z');

/** Escritor que puede fallar al registrar el historial, después de insertar el turno. */
export class ControllableAppointmentWriter extends AppointmentWriter {
  failNextEvents = false;

  override async insertEvents(manager: EntityManager, events: readonly NewAppointmentEvent[]): Promise<void> {
    if (this.failNextEvents) {
      this.failNextEvents = false;
      throw new Error('Simulated history write failure');
    }
    await super.insertEvents(manager, events);
  }
}

export interface AppointmentApiContext {
  app: INestApplication<App>;
  /** Conexión aparte para preparar datos y leer valores literales de la base. */
  db: DataSource;
  sessionCookie: string;
  clock: FixedClock;
  writer: ControllableAppointmentWriter;
}

export interface Fixtures {
  patientId: string;
  procedureId: string;
  procedureWithIntervalId: string;
  chair1Id: string;
  chair2Id: string;
}

export async function startAppointmentApi(): Promise<AppointmentApiContext> {
  const db = createTestDataSource(process.env);
  await db.initialize();
  await db.runMigrations({ transaction: 'all' });
  await cleanupC05Data(db);
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

  const clock = new FixedClock(TEST_NOW);
  const writer = new ControllableAppointmentWriter();
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

export async function stopAppointmentApi(context: AppointmentApiContext | undefined): Promise<void> {
  if (!context) return;
  await cleanupC05Data(context.db);
  await context.app.close();
  if (context.db.isInitialized) await context.db.destroy();
}

/** Borra turnos y eventos (primero, por la FK) y restablece la disponibilidad que C-05 modifica. */
export async function cleanupC05Data(db: DataSource): Promise<void> {
  await db.query('DELETE FROM appointment_events');
  await db.query('DELETE FROM appointments');
  await db.query('DELETE FROM excepcion_disponibilidad');
  await db.query('DELETE FROM disponibilidad_semanal');
  await db.query(
    "UPDATE configuracion_agenda SET intervalo_global_minutos = 10 WHERE id = '00000000-0000-4000-8000-000000000001'",
  );
  await db.query("DELETE FROM patients WHERE name LIKE 'Paciente Ficticio C05%'");
  await db.query("DELETE FROM procedures WHERE name LIKE 'Prestación ficticia C05%'");
  await db.query("DELETE FROM chairs WHERE name LIKE 'Sillón ficticio C05%'");
}

export function api(context: AppointmentApiContext) {
  const server = context.app.getHttpServer();
  return {
    post: (path: string, body: object) => request(server).post(`/api${path}`).set('Cookie', context.sessionCookie).send(body),
    put: (path: string, body: object) => request(server).put(`/api${path}`).set('Cookie', context.sessionCookie).send(body),
    patch: (path: string, body: object) => request(server).patch(`/api${path}`).set('Cookie', context.sessionCookie).send(body),
    anonymousPost: (path: string, body: object) => request(server).post(`/api${path}`).send(body),
  };
}

/** Crea referencias y deja el miércoles 09:00–13:00 disponible, todo por las APIs de C-02 y C-03. */
export async function seedFixtures(context: AppointmentApiContext): Promise<Fixtures> {
  const http = api(context);
  const created = async (path: string, body: object): Promise<string> => {
    const response = await http.post(path, body);
    if (response.status !== 201) throw new Error(`Fixture ${path} failed: ${response.status} ${JSON.stringify(response.body)}`);
    return (response.body as { id: string }).id;
  };
  const fixtures: Fixtures = {
    patientId: await created('/pacientes', { nombre: 'Paciente Ficticio C05 Uno', telefono: '11 5555-0501', confirmarPosibleDuplicado: true }),
    procedureId: await created('/prestaciones', { nombre: 'Prestación ficticia C05 sin intervalo', duracionPredeterminadaMinutos: 30 }),
    procedureWithIntervalId: await created('/prestaciones', {
      nombre: 'Prestación ficticia C05 con intervalo',
      duracionPredeterminadaMinutos: 30,
      intervaloPosteriorMinutos: 5,
    }),
    chair1Id: await created('/sillones', { nombre: 'Sillón ficticio C05 A' }),
    chair2Id: await created('/sillones', { nombre: 'Sillón ficticio C05 B' }),
  };
  const weekly = await http.put('/disponibilidad/semanales', { tramos: [{ diaSemana: 3, horaInicio: '09:00', horaFin: '13:00' }] });
  if (weekly.status !== 200) throw new Error(`Weekly availability failed: ${weekly.status}`);
  return fixtures;
}

export async function clearAppointments(db: DataSource): Promise<void> {
  await db.query('DELETE FROM appointment_events');
  await db.query('DELETE FROM appointments');
}

/** Valor literal guardado en MariaDB, sin conversión del driver. */
export async function storedStartsAt(db: DataSource, id: string): Promise<string> {
  const rows = (await db.query("SELECT DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS value FROM appointments WHERE id = ?", [id])) as Array<{ value: string }>;
  return rows[0]?.value ?? '';
}
