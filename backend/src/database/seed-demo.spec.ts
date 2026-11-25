import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { createTestDataSource } from './data-source.js';
import { DEMO_IDS, seedDemo } from './seed-demo.js';

const requiredDatabaseKeys = [
  'TEST_DATABASE_HOST',
  'TEST_DATABASE_PORT',
  'TEST_DATABASE_NAME',
  'TEST_DATABASE_USER',
  'TEST_DATABASE_PASSWORD',
] as const;
const mariaDbConfigured = requiredDatabaseKeys.every((key) => Boolean(process.env[key]));
const describeMariaDb = mariaDbConfigured ? describe : describe.skip;
const externalPatientId = randomUUID();

async function cleanupSeed(dataSource: DataSource): Promise<void> {
  await dataSource.query(`DELETE FROM appointment_events WHERE id IN (${DEMO_IDS.events.map(() => '?').join(',')})`, [...DEMO_IDS.events]);
  await dataSource.query(`DELETE FROM appointments WHERE id IN (${DEMO_IDS.appointments.map(() => '?').join(',')})`, [...DEMO_IDS.appointments]);
  await dataSource.query('DELETE FROM excepcion_disponibilidad WHERE id = ?', [DEMO_IDS.blockingException]);
  await dataSource.query('DELETE FROM disponibilidad_semanal WHERE id = ?', [DEMO_IDS.weeklyAvailability]);
  await dataSource.query(`DELETE FROM patients WHERE id IN (${DEMO_IDS.patients.map(() => '?').join(',')})`, [...DEMO_IDS.patients]);
  await dataSource.query(`DELETE FROM procedures WHERE id IN (${DEMO_IDS.procedures.map(() => '?').join(',')})`, [...DEMO_IDS.procedures]);
  await dataSource.query(`DELETE FROM chairs WHERE id IN (${DEMO_IDS.chairs.map(() => '?').join(',')})`, [...DEMO_IDS.chairs]);
  await dataSource.query('DELETE FROM patients WHERE id = ?', [externalPatientId]);
}

async function countRows(dataSource: DataSource, table: string, ids: readonly string[]): Promise<number> {
  const rows = (await dataSource.query(
    `SELECT COUNT(*) AS count FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`,
    [...ids],
  )) as Array<{ count: string | number }>;
  return Number(rows[0]?.count ?? 0);
}

describeMariaDb('seedDemo with MariaDB', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = createTestDataSource(process.env);
    await dataSource.initialize();
    await dataSource.runMigrations({ transaction: 'all' });
    await cleanupSeed(dataSource);
  });

  afterAll(async () => {
    await cleanupSeed(dataSource);
    if (dataSource.isInitialized) await dataSource.destroy();
  });

  it('is transactional and idempotent without deleting unrelated records', async () => {
    await dataSource.query(
      `INSERT INTO patients (id, name, phone, phone_digits, dni, email, active)
       VALUES (?, 'Paciente Ficticio Ajeno al Seed', '0000-9999', '00009999', NULL, NULL, TRUE)`,
      [externalPatientId],
    );
    const fixedNow = new Date('2026-11-24T12:00:00.000Z');

    await seedDemo(dataSource, fixedNow);
    await seedDemo(dataSource, fixedNow);

    await expect(countRows(dataSource, 'patients', DEMO_IDS.patients)).resolves.toBe(5);
    await expect(countRows(dataSource, 'procedures', DEMO_IDS.procedures)).resolves.toBe(2);
    await expect(countRows(dataSource, 'chairs', DEMO_IDS.chairs)).resolves.toBe(2);
    await expect(countRows(dataSource, 'disponibilidad_semanal', [DEMO_IDS.weeklyAvailability])).resolves.toBe(1);
    await expect(countRows(dataSource, 'excepcion_disponibilidad', [DEMO_IDS.blockingException])).resolves.toBe(1);
    await expect(countRows(dataSource, 'appointments', DEMO_IDS.appointments)).resolves.toBe(5);
    await expect(countRows(dataSource, 'appointment_events', DEMO_IDS.events)).resolves.toBe(6);
    await expect(countRows(dataSource, 'patients', [externalPatientId])).resolves.toBe(1);

    const procedureRows = (await dataSource.query(
      'SELECT post_interval_minutes AS postIntervalMinutes FROM procedures WHERE id = ?',
      [DEMO_IDS.procedures[0]],
    )) as Array<{ postIntervalMinutes: number }>;
    expect(procedureRows[0]?.postIntervalMinutes).toBe(10);

    const exceptionRows = (await dataSource.query(
      `SELECT outside_availability AS outsideAvailability, exception_reason AS exceptionReason
       FROM appointments WHERE id = ?`,
      [DEMO_IDS.appointments[4]],
    )) as Array<{ outsideAvailability: number; exceptionReason: string | null }>;
    expect(exceptionRows[0]).toMatchObject({
      outsideAvailability: 1,
      exceptionReason: 'Excepción ficticia para demostración',
    });

    const statusRows = (await dataSource.query(
      `SELECT status, COUNT(*) AS count FROM appointments
       WHERE id IN (${DEMO_IDS.appointments.map(() => '?').join(',')}) GROUP BY status`,
      [...DEMO_IDS.appointments],
    )) as Array<{ status: string; count: string | number }>;
    expect(new Map(statusRows.map((row) => [row.status, Number(row.count)]))).toEqual(
      new Map([
        ['PROGRAMADO', 1],
        ['CONFIRMADO', 1],
        ['ATENDIDO', 1],
        ['CANCELADO', 1],
        ['AUSENTE', 1],
      ]),
    );
  });
});
