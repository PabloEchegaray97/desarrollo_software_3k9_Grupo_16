import type { AppointmentStatus } from '../../core/domain/appointment-status.js';

/** Motivo de rechazo de una comprobación de ciclo de vida (sin acoplamiento a HTTP). */
export type TransitionDenialReason = 'INVALID_TRANSITION' | 'NOT_RESCHEDULABLE';

export type TransitionCheck = { ok: true } | { ok: false; reason: TransitionDenialReason };

/**
 * Única autoridad de la matriz de RN-TU-13/14/17. `CANCELADO` figura como destino
 * permitido, pero la ruta `/estado` no lo admite: la cancelación exige motivo.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> = {
  PROGRAMADO: ['CONFIRMADO', 'ATENDIDO', 'AUSENTE', 'CANCELADO'],
  CONFIRMADO: ['ATENDIDO', 'AUSENTE', 'CANCELADO'],
  ATENDIDO: [],
  AUSENTE: [],
  CANCELADO: [],
};

/** RN-TU-15/19: ningún estado terminal admite una nueva transición. */
export const TERMINAL_STATUSES: readonly AppointmentStatus[] = ['ATENDIDO', 'AUSENTE', 'CANCELADO'];

/** RN-TU-17: solo estos estados pueden reprogramarse. */
export const RESCHEDULABLE_STATUSES: readonly AppointmentStatus[] = ['PROGRAMADO', 'CONFIRMADO'];

export function isTerminalStatus(status: AppointmentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isReschedulable(status: AppointmentStatus): boolean {
  return RESCHEDULABLE_STATUSES.includes(status);
}

export function assertTransition(from: AppointmentStatus, to: AppointmentStatus): TransitionCheck {
  return ALLOWED_TRANSITIONS[from].includes(to) ? { ok: true } : { ok: false, reason: 'INVALID_TRANSITION' };
}

export function assertReschedulable(from: AppointmentStatus): TransitionCheck {
  return isReschedulable(from) ? { ok: true } : { ok: false, reason: 'NOT_RESCHEDULABLE' };
}

/**
 * RN-TU-16: ventana `[inicio, sin cota superior)`. El reloj se inyecta como argumento:
 * esta función no lee la hora del proceso ni interpreta zonas locales.
 */
export function isStatusObserved(now: Date, startsAt: Date): boolean {
  return now.getTime() >= startsAt.getTime();
}
