/** Estados del turno (RN-TU-06). */
export const APPOINTMENT_STATUSES = ['PROGRAMADO', 'CONFIRMADO', 'ATENDIDO', 'CANCELADO', 'AUSENTE'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Estados que ocupan su período `[inicio, finBloqueo)` (RN-TU-07). CANCELADO libera el horario. */
export const BLOCKING_STATUSES: readonly AppointmentStatus[] = ['PROGRAMADO', 'CONFIRMADO', 'ATENDIDO', 'AUSENTE'];

export function isBlockingStatus(status: AppointmentStatus): boolean {
  return BLOCKING_STATUSES.includes(status);
}

/** Tipos de evento de historial (KB `EventoTurno`). C-05 emite CREADO y EXCEPCION; C-06 el resto. */
export const APPOINTMENT_EVENT_TYPES = ['CREADO', 'REPROGRAMADO', 'CANCELADO', 'CAMBIO_ESTADO', 'EXCEPCION'] as const;
export type AppointmentEventType = (typeof APPOINTMENT_EVENT_TYPES)[number];

/** Límites de sobrescritura (RN-PR-08). */
export const APPOINTMENT_DURATION_MIN = 1;
export const APPOINTMENT_DURATION_MAX = 240;
export const APPOINTMENT_INTERVAL_MIN = 0;
export const APPOINTMENT_INTERVAL_MAX = 30;
