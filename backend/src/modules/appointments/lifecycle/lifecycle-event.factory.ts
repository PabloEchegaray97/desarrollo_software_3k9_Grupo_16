import { randomUUID } from 'node:crypto';
import type { AppointmentStatus } from '../core/domain/appointment-status.js';
import type { NewAppointmentEvent } from '../core/database/appointment-writer.js';

export interface RescheduleEventInput {
  appointmentId: string;
  previousStatus: AppointmentStatus;
  previousStartsAt: Date;
  newStartsAt: Date;
  previousChairId: string;
  newChairId: string;
  /** Motivo normalizado, validado por `RescheduleAppointmentDto`. */
  reason: string;
  occurredAt: Date;
  /** Solo presente cuando la nueva ubicación cae fuera de la disponibilidad semanal. */
  exceptionReason?: string | null;
}

export interface CancelEventInput {
  appointmentId: string;
  previousStatus: AppointmentStatus;
  /** Motivo normalizado; se persiste también en `appointments.cancellation_reason`. */
  reason: string;
  occurredAt: Date;
}

export interface StatusChangeEventInput {
  appointmentId: string;
  previousStatus: AppointmentStatus;
  newStatus: AppointmentStatus;
  occurredAt: Date;
}

type EventFields = Omit<NewAppointmentEvent, 'id'>;

/** Los eventos inmutables solo se crean aquí; el ID siempre es un UUID nuevo. */
function withId(fields: EventFields): NewAppointmentEvent {
  return { id: randomUUID(), ...fields };
}

/** Cambios de estado y cancelación no registran inicios ni sillones (design § Evento por operación). */
const EMPTY_PERIOD = {
  previousStartsAt: null,
  newStartsAt: null,
  previousChairId: null,
  newChairId: null,
} as const;

/**
 * Eventos de reprogramación (design § Evento por operación). Un `CONFIRMADO` vuelve
 * explícitamente a `PROGRAMADO` (RN-TU-18) sin un `CAMBIO_ESTADO` adicional.
 */
export function buildRescheduleEvents(input: RescheduleEventInput): NewAppointmentEvent[] {
  const reprogramado = withId({
    appointmentId: input.appointmentId,
    type: 'REPROGRAMADO',
    occurredAt: input.occurredAt,
    previousStatus: input.previousStatus,
    newStatus: 'PROGRAMADO',
    previousStartsAt: input.previousStartsAt,
    newStartsAt: input.newStartsAt,
    previousChairId: input.previousChairId,
    newChairId: input.newChairId,
    reason: input.reason,
  });
  if (!input.exceptionReason) return [reprogramado];
  return [
    reprogramado,
    withId({
      appointmentId: input.appointmentId,
      type: 'EXCEPCION',
      occurredAt: input.occurredAt,
      previousStatus: null,
      newStatus: null,
      ...EMPTY_PERIOD,
      reason: input.exceptionReason,
    }),
  ];
}

/** Cancelación: motivo obligatorio y ningún inicio/sillón asociado al evento (RN-TU-14). */
export function buildCancelEvent(input: CancelEventInput): NewAppointmentEvent {
  return withId({
    appointmentId: input.appointmentId,
    type: 'CANCELADO',
    occurredAt: input.occurredAt,
    previousStatus: input.previousStatus,
    newStatus: 'CANCELADO',
    ...EMPTY_PERIOD,
    reason: input.reason,
  });
}

/** Confirmar/atender/marcar ausencia: solo estados anterior y nuevo, sin motivo. */
export function buildStatusChangeEvent(input: StatusChangeEventInput): NewAppointmentEvent {
  return withId({
    appointmentId: input.appointmentId,
    type: 'CAMBIO_ESTADO',
    occurredAt: input.occurredAt,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    ...EMPTY_PERIOD,
    reason: null,
  });
}
