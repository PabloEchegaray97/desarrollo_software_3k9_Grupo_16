import { pathToFileURL } from 'node:url';
import path from 'node:path';
import type { DataSource, QueryRunner } from 'typeorm';
import { loadEnvironment } from '../config/load-environment.js';
import { ZONA_IANA } from '../modules/availability/availability.constants.js';
import { createApplicationDataSource } from './data-source.js';

const DEMO_PREFIX = '10000000-0000-4000-8000-0000000000';

export const DEMO_IDS = {
  patients: [`${DEMO_PREFIX}01`, `${DEMO_PREFIX}02`, `${DEMO_PREFIX}03`, `${DEMO_PREFIX}04`, `${DEMO_PREFIX}05`],
  procedures: [`${DEMO_PREFIX}11`, `${DEMO_PREFIX}12`],
  chairs: [`${DEMO_PREFIX}21`, `${DEMO_PREFIX}22`],
  weeklyAvailability: `${DEMO_PREFIX}31`,
  blockingException: `${DEMO_PREFIX}32`,
  appointments: [`${DEMO_PREFIX}41`, `${DEMO_PREFIX}42`, `${DEMO_PREFIX}43`, `${DEMO_PREFIX}44`, `${DEMO_PREFIX}45`],
  events: [`${DEMO_PREFIX}51`, `${DEMO_PREFIX}52`, `${DEMO_PREFIX}53`, `${DEMO_PREFIX}54`, `${DEMO_PREFIX}55`, `${DEMO_PREFIX}56`],
} as const;

export interface SeedDemoResult {
  localDate: string;
  appointments: number;
}

interface DemoAppointment {
  id: string;
  patientId: string;
  procedureId: string;
  chairId: string;
  startsAt: Date;
  durationMinutes: number;
  postIntervalMinutes: number;
  status: 'PROGRAMADO' | 'CONFIRMADO' | 'ATENDIDO' | 'CANCELADO' | 'AUSENTE';
  outsideAvailability: boolean;
  exceptionReason: string | null;
  cancellationReason: string | null;
}

function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function localWeekday(date: Date, timeZone: string): number {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const weekdays: Readonly<Record<string, number>> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const weekday = weekdays[day];
  if (weekday === undefined) throw new Error(`Unsupported weekday: ${day}`);
  return weekday;
}

function utcInstantForLocalTime(date: string, hour: number, minute: number, timeZone: string): Date {
  const [yearText, monthText, dayText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const guess = new Date(targetAsUtc);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(guess).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(targetAsUtc - (representedAsUtc - guess.getTime()));
}

async function upsertReferences(queryRunner: QueryRunner): Promise<void> {
  const patientNames = ['Martina Demo', 'Tomás Demo', 'Elena Demo', 'Lucas Demo', 'Sofía Demo'];
  for (const [index, id] of DEMO_IDS.patients.entries()) {
    const suffix = String(index + 1).padStart(2, '0');
    await queryRunner.query(
      `INSERT INTO patients (id, name, phone, phone_digits, dni, email, active)
       VALUES (?, ?, ?, ?, NULL, NULL, TRUE)
       ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), phone_digits = VALUES(phone_digits), active = TRUE`,
      [id, patientNames[index], `0000-00${suffix}`, `000000${suffix}`],
    );
  }

  await queryRunner.query(
    `INSERT INTO procedures (id, name, default_duration_minutes, post_interval_minutes, active)
     VALUES (?, 'Control OdoSoft Demo', 30, 10, TRUE)
     ON DUPLICATE KEY UPDATE default_duration_minutes = 30, post_interval_minutes = 10, active = TRUE`,
    [DEMO_IDS.procedures[0]],
  );
  await queryRunner.query(
    `INSERT INTO procedures (id, name, default_duration_minutes, post_interval_minutes, active)
     VALUES (?, 'Restauración OdoSoft Demo', 45, NULL, TRUE)
     ON DUPLICATE KEY UPDATE default_duration_minutes = 45, post_interval_minutes = NULL, active = TRUE`,
    [DEMO_IDS.procedures[1]],
  );
  for (const [index, id] of DEMO_IDS.chairs.entries()) {
    await queryRunner.query(
      `INSERT INTO chairs (id, name, active) VALUES (?, ?, TRUE)
       ON DUPLICATE KEY UPDATE active = TRUE`,
      [id, `Sillón OdoSoft Demo ${index + 1}`],
    );
  }
}

async function upsertAvailability(queryRunner: QueryRunner, now: Date, date: string): Promise<void> {
  await queryRunner.query(
    `INSERT INTO disponibilidad_semanal (id, dia_semana, hora_inicio, hora_fin)
     VALUES (?, ?, '08:00:00', '18:00:00')
     ON DUPLICATE KEY UPDATE dia_semana = VALUES(dia_semana), hora_inicio = VALUES(hora_inicio), hora_fin = VALUES(hora_fin)`,
    [DEMO_IDS.weeklyAvailability, localWeekday(now, ZONA_IANA)],
  );
  await queryRunner.query(
    `INSERT INTO excepcion_disponibilidad
       (id, fecha, tipo, motivo, hora_inicio, hora_fin, inicio_utc, fin_utc, activo)
     VALUES (?, ?, 'BLOQUEO', 'Bloqueo ficticio OdoSoft Demo', '16:00:00', '16:30:00', ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE fecha = VALUES(fecha), tipo = VALUES(tipo), motivo = VALUES(motivo),
       hora_inicio = VALUES(hora_inicio), hora_fin = VALUES(hora_fin), inicio_utc = VALUES(inicio_utc),
       fin_utc = VALUES(fin_utc), activo = TRUE`,
    [
      DEMO_IDS.blockingException,
      date,
      utcInstantForLocalTime(date, 16, 0, ZONA_IANA),
      utcInstantForLocalTime(date, 16, 30, ZONA_IANA),
    ],
  );
}

async function upsertAppointment(queryRunner: QueryRunner, appointment: DemoAppointment): Promise<void> {
  const careEndsAt = new Date(appointment.startsAt.getTime() + appointment.durationMinutes * 60_000);
  const blockEndsAt = new Date(careEndsAt.getTime() + appointment.postIntervalMinutes * 60_000);
  await queryRunner.query(
    `INSERT INTO appointments
       (id, patient_id, procedure_id, chair_id, starts_at, care_ends_at, block_ends_at,
        duration_minutes, post_interval_minutes, status, outside_availability, exception_reason, cancellation_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE patient_id = VALUES(patient_id), procedure_id = VALUES(procedure_id),
       chair_id = VALUES(chair_id), starts_at = VALUES(starts_at), care_ends_at = VALUES(care_ends_at),
       block_ends_at = VALUES(block_ends_at), duration_minutes = VALUES(duration_minutes),
       post_interval_minutes = VALUES(post_interval_minutes), status = VALUES(status),
       outside_availability = VALUES(outside_availability), exception_reason = VALUES(exception_reason),
       cancellation_reason = VALUES(cancellation_reason)`,
    [
      appointment.id,
      appointment.patientId,
      appointment.procedureId,
      appointment.chairId,
      appointment.startsAt,
      careEndsAt,
      blockEndsAt,
      appointment.durationMinutes,
      appointment.postIntervalMinutes,
      appointment.status,
      appointment.outsideAvailability,
      appointment.exceptionReason,
      appointment.cancellationReason,
    ],
  );
}

async function upsertEvent(
  queryRunner: QueryRunner,
  id: string,
  appointment: DemoAppointment,
  type: 'CREADO' | 'EXCEPCION',
  reason: string | null,
): Promise<void> {
  await queryRunner.query(
    `INSERT INTO appointment_events
       (id, appointment_id, type, occurred_at, previous_status, new_status, previous_starts_at,
        new_starts_at, previous_chair_id, new_chair_id, reason)
     VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, NULL, ?, ?)
     ON DUPLICATE KEY UPDATE appointment_id = VALUES(appointment_id), type = VALUES(type),
       occurred_at = VALUES(occurred_at), new_status = VALUES(new_status), new_starts_at = VALUES(new_starts_at),
       new_chair_id = VALUES(new_chair_id), reason = VALUES(reason)`,
    [id, appointment.id, type, appointment.startsAt, appointment.status, appointment.startsAt, appointment.chairId, reason],
  );
}

export async function seedDemo(dataSource: DataSource, now = new Date()): Promise<SeedDemoResult> {
  const date = localDate(now, ZONA_IANA);
  const starts = (hour: number, minute = 0) => utcInstantForLocalTime(date, hour, minute, ZONA_IANA);
  const appointments: DemoAppointment[] = [
    { id: DEMO_IDS.appointments[0], patientId: DEMO_IDS.patients[0], procedureId: DEMO_IDS.procedures[0], chairId: DEMO_IDS.chairs[0], startsAt: starts(9), durationMinutes: 30, postIntervalMinutes: 10, status: 'PROGRAMADO', outsideAvailability: false, exceptionReason: null, cancellationReason: null },
    { id: DEMO_IDS.appointments[1], patientId: DEMO_IDS.patients[1], procedureId: DEMO_IDS.procedures[1], chairId: DEMO_IDS.chairs[1], startsAt: starts(10, 15), durationMinutes: 45, postIntervalMinutes: 10, status: 'CONFIRMADO', outsideAvailability: false, exceptionReason: null, cancellationReason: null },
    { id: DEMO_IDS.appointments[2], patientId: DEMO_IDS.patients[2], procedureId: DEMO_IDS.procedures[0], chairId: DEMO_IDS.chairs[0], startsAt: starts(11, 30), durationMinutes: 30, postIntervalMinutes: 10, status: 'ATENDIDO', outsideAvailability: false, exceptionReason: null, cancellationReason: null },
    { id: DEMO_IDS.appointments[3], patientId: DEMO_IDS.patients[3], procedureId: DEMO_IDS.procedures[0], chairId: DEMO_IDS.chairs[1], startsAt: starts(12, 45), durationMinutes: 30, postIntervalMinutes: 10, status: 'AUSENTE', outsideAvailability: false, exceptionReason: null, cancellationReason: null },
    { id: DEMO_IDS.appointments[4], patientId: DEMO_IDS.patients[4], procedureId: DEMO_IDS.procedures[1], chairId: DEMO_IDS.chairs[0], startsAt: starts(19), durationMinutes: 45, postIntervalMinutes: 10, status: 'CANCELADO', outsideAvailability: true, exceptionReason: 'Excepción ficticia para demostración', cancellationReason: 'Cancelación ficticia para demostración' },
  ];

  await dataSource.transaction(async (manager) => {
    const queryRunner = manager.queryRunner;
    if (!queryRunner) throw new Error('Demo seed requires a transactional query runner');
    await upsertReferences(queryRunner);
    await upsertAvailability(queryRunner, now, date);
    for (const appointment of appointments) await upsertAppointment(queryRunner, appointment);
    for (const [index, appointment] of appointments.entries()) {
      await upsertEvent(queryRunner, DEMO_IDS.events[index], appointment, 'CREADO', null);
    }
    await upsertEvent(queryRunner, DEMO_IDS.events[5], appointments[4], 'EXCEPCION', appointments[4].exceptionReason);
  });

  return { localDate: date, appointments: appointments.length };
}

async function main(): Promise<void> {
  loadEnvironment();
  const dataSource = createApplicationDataSource(process.env);
  await dataSource.initialize();
  try {
    const result = await seedDemo(dataSource);
    console.info(`Datos ficticios OdoSoft Demo listos para ${result.localDate}: ${result.appointments} turnos.`);
  } finally {
    await dataSource.destroy();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) await main();
