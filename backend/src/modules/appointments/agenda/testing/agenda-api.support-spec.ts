/**
 * Soporte de las pruebas de integración de C-07 (no es una suite).
 * El sufijo `.support-spec.ts` no coincide con `*.spec.ts` ni con `*.integration-spec.ts`.
 *
 * - MariaDB real (`TEST_DATABASE_*`); nunca SQLite ni base en memoria.
 * - NO reemplaza el `DataSource` de la aplicación: prueba la conexión de producción.
 * - Solo reemplaza el reloj (fijo), para poder crear turnos en 2027.
 * - La limpieza de turnos y eventos debe ejecutarse en `afterAll`: la FK `RESTRICT` de `appointments`
 *   impediría la limpieza de pacientes y catálogos de C-02 en las suites que corren después.
 */
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../../../database/data-source.js';
import { authenticatedCookie } from '../../../auth/testing/session-test.support-spec.js';
import { APPOINTMENT_CLOCK, FixedClock } from '../../core/clock.js';

/** Reloj de todas las pruebas: anterior a cualquier fecha de fixture. */
export const TEST_NOW = new Date('2027-03-01T12:00:00.000Z');

/** Datos de contacto ficticios del paciente de fixture; la prueba de privacidad verifica que no salgan. */
export const FICTIONAL_CONTACT = {
  phone: '11 5555-0701',
  dni: '12345678',
  email: 'paciente.ficticio.c07@example.test',
} as const;

export interface AgendaApiContext {
  app: INestApplication<App>;
  /** Conexión aparte para preparar datos y leer valores literales de la base. */
  db: DataSource;
  sessionCookie: string;
  clock: FixedClock;
}

export interface Fixtures {
  patientId: string;
  procedureId: string;
  procedureWithIntervalId: string;
  chair1Id: string;
  chair2Id: string;
  chair3Id: string;
}

export async function startAgendaApi(): Promise<AgendaApiContext> {
  const db = createTestDataSource(process.env);
  await db.initialize();
  await db.runMigrations({ transaction: 'all' });
  await cleanupC07Data(db);
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
  const { AppModule } = await import('../../../../app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APPOINTMENT_CLOCK)
    .useValue(clock)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.init();
  return { app, db, sessionCookie, clock };
}

export async function stopAgendaApi(context: AgendaApiContext | undefined): Promise<void> {
  if (!context) return;
  await cleanupC07Data(context.db);
  await context.app.close();
  if (context.db.isInitialized) await context.db.destroy();
}

/** Borra turnos y eventos (primero, por la FK), la disponibilidad que C-07 crea y sus fixtures ficticios. */
export async function cleanupC07Data(db: DataSource): Promise<void> {
  await db.query('DELETE FROM appointment_events');
  await db.query('DELETE FROM appointments');
  await db.query('DELETE FROM excepcion_disponibilidad');
  await db.query('DELETE FROM disponibilidad_semanal');
  await db.query(
    "UPDATE configuracion_agenda SET intervalo_global_minutos = 10 WHERE id = '00000000-0000-4000-8000-000000000001'",
  );
  await db.query("DELETE FROM patients WHERE name LIKE 'Paciente Ficticio C07%'");
  await db.query("DELETE FROM procedures WHERE name LIKE 'Prestación ficticia C07%'");
  await db.query("DELETE FROM chairs WHERE name LIKE 'Sillón ficticio C07%'");
}

export async function clearAppointments(db: DataSource): Promise<void> {
  await db.query('DELETE FROM appointment_events');
  await db.query('DELETE FROM appointments');
}

export function api(context: AgendaApiContext) {
  const server = context.app.getHttpServer();
  return {
    get: (path: string) => request(server).get(`/api${path}`).set('Cookie', context.sessionCookie),
    anonymousGet: (path: string) => request(server).get(`/api${path}`),
    post: (path: string, body: object) => request(server).post(`/api${path}`).set('Cookie', context.sessionCookie).send(body),
    put: (path: string, body: object) => request(server).put(`/api${path}`).set('Cookie', context.sessionCookie).send(body),
    patch: (path: string, body: object) => request(server).patch(`/api${path}`).set('Cookie', context.sessionCookie).send(body),
  };
}

/**
 * Crea referencias y deja los miércoles 09:00–13:00 y 16:00–20:00 y los jueves 09:00–13:00 disponibles,
 * todo por las APIs de C-02 y C-03.
 */
export async function seedFixtures(context: AgendaApiContext): Promise<Fixtures> {
  const http = api(context);
  const created = async (path: string, body: object): Promise<string> => {
    const response = await http.post(path, body);
    if (response.status !== 201) throw new Error(`Fixture ${path} failed: ${response.status} ${JSON.stringify(response.body)}`);
    return (response.body as { id: string }).id;
  };
  const fixtures: Fixtures = {
    patientId: await created('/pacientes', {
      nombre: 'Paciente Ficticio C07 Uno',
      telefono: FICTIONAL_CONTACT.phone,
      dni: FICTIONAL_CONTACT.dni,
      email: FICTIONAL_CONTACT.email,
      confirmarPosibleDuplicado: true,
    }),
    procedureId: await created('/prestaciones', { nombre: 'Prestación ficticia C07 sin intervalo', duracionPredeterminadaMinutos: 30 }),
    procedureWithIntervalId: await created('/prestaciones', {
      nombre: 'Prestación ficticia C07 con intervalo',
      duracionPredeterminadaMinutos: 30,
      intervaloPosteriorMinutos: 5,
    }),
    chair1Id: await created('/sillones', { nombre: 'Sillón ficticio C07 A' }),
    chair2Id: await created('/sillones', { nombre: 'Sillón ficticio C07 B' }),
    chair3Id: await created('/sillones', { nombre: 'Sillón ficticio C07 C' }),
  };
  const weekly = await http.put('/disponibilidad/semanales', {
    tramos: [
      { diaSemana: 3, horaInicio: '09:00', horaFin: '13:00' },
      { diaSemana: 3, horaInicio: '16:00', horaFin: '20:00' },
      { diaSemana: 4, horaInicio: '09:00', horaFin: '13:00' },
    ],
  });
  if (weekly.status !== 200) throw new Error(`Weekly availability failed: ${weekly.status} ${JSON.stringify(weekly.body)}`);
  return fixtures;
}

/** Fija el estado por SQL: C-06 (cambio de estado) aún no existe en esta rama. Solo para pruebas. */
export async function setStatus(db: DataSource, appointmentId: string, status: string, cancellationReason?: string): Promise<void> {
  await db.query('UPDATE appointments SET status = ?, cancellation_reason = ? WHERE id = ?', [
    status,
    cancellationReason ?? null,
    appointmentId,
  ]);
}
