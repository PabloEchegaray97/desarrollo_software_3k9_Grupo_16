/**
 * Política temporal pura de turnos (sin I/O ni reloj). La consumen la creación (C-05)
 * y, más adelante, la reprogramación (C-06) y la agenda (C-07).
 */
import { isBlockingStatus, type AppointmentStatus } from './appointment-status.js';

const MINUTE_MS = 60_000;

export interface EffectiveTimesInput {
  /** Sobrescritura del turno; `undefined` si no se informó. */
  overrideDurationMinutes?: number;
  overrideIntervalMinutes?: number;
  procedureDurationMinutes: number;
  /** `null`: la prestación delega en el intervalo global. */
  procedureIntervalMinutes: number | null;
  globalIntervalMinutes: number;
}

export interface EffectiveTimes {
  durationMinutes: number;
  postIntervalMinutes: number;
}

/** RN-PR-05/06: duración turno → prestación; intervalo turno → prestación → global. */
export function resolveEffectiveTimes(input: EffectiveTimesInput): EffectiveTimes {
  return {
    durationMinutes: input.overrideDurationMinutes ?? input.procedureDurationMinutes,
    postIntervalMinutes:
      input.overrideIntervalMinutes ?? input.procedureIntervalMinutes ?? input.globalIntervalMinutes,
  };
}

/** Período bloqueado semiabierto `[startsAt, blockEndsAt)` (RN-TU-01/02). */
export interface BlockedPeriod {
  startsAt: Date;
  careEndsAt: Date;
  blockEndsAt: Date;
}

export function blockedPeriod(startsAt: Date, times: EffectiveTimes): BlockedPeriod {
  const careEndsAt = new Date(startsAt.getTime() + times.durationMinutes * MINUTE_MS);
  return {
    startsAt,
    careEndsAt,
    blockEndsAt: new Date(careEndsAt.getTime() + times.postIntervalMinutes * MINUTE_MS),
  };
}

/** Intersección de intervalos semiabiertos: terminar exactamente al comenzar el otro no es conflicto. */
export function periodsConflict(
  left: Pick<BlockedPeriod, 'startsAt' | 'blockEndsAt'>,
  right: Pick<BlockedPeriod, 'startsAt' | 'blockEndsAt'>,
): boolean {
  return left.startsAt.getTime() < right.blockEndsAt.getTime() && right.startsAt.getTime() < left.blockEndsAt.getTime();
}

export interface ScheduledAppointment {
  id: string;
  chairId: string;
  status: AppointmentStatus;
  startsAt: Date;
  blockEndsAt: Date;
}

export type ConflictScope = 'SILLON' | 'ODONTOLOGO';

export interface ConflictReport {
  /** `SILLON` si algún conflicto usa el mismo sillón; `ODONTOLOGO` si todos están en otros sillones. */
  scope: ConflictScope;
  conflicts: ScheduledAppointment[];
}

/**
 * RN-TU-03/04: con un único odontólogo todo conflicto de sillón es también del odontólogo,
 * por lo que se informa un único reporte con el alcance más específico.
 */
export function classifyConflicts(
  candidate: Pick<BlockedPeriod, 'startsAt' | 'blockEndsAt'>,
  chairId: string,
  existing: readonly ScheduledAppointment[],
  excludeId?: string,
): ConflictReport | null {
  const conflicts = existing
    .filter((appointment) => appointment.id !== excludeId)
    .filter((appointment) => isBlockingStatus(appointment.status))
    .filter((appointment) => periodsConflict(candidate, appointment))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime() || left.id.localeCompare(right.id));
  if (conflicts.length === 0) return null;
  return {
    scope: conflicts.some((appointment) => appointment.chairId === chairId) ? 'SILLON' : 'ODONTOLOGO',
    conflicts,
  };
}
