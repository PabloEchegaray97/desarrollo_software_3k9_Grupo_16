import {
  appointmentNotFound as lifecycleAppointmentNotFound,
  type LifecycleError,
} from '../lifecycle/lifecycle-errors.js';

/** Códigos neutrales que el historial puede publicar (design § Contratos HTTP). */
export type HistoryErrorCode = 'APPOINTMENT_NOT_FOUND';
export type HistoryError = LifecycleError;

/** Una sola definición del 404 para mutaciones y consulta; sin datos de paciente. */
export const appointmentNotFound = (): HistoryError => lifecycleAppointmentNotFound();
