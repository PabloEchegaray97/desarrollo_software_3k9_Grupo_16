import { HttpException, HttpStatus } from '@nestjs/common';
import type { BlockedPeriod, ConflictReport } from '../core/domain/appointment-policy.js';

export type AppointmentErrorCode =
  | 'APPOINTMENT_INVALID_TIME'
  | 'APPOINTMENT_REFERENCE_INVALID'
  | 'APPOINTMENT_IN_PAST'
  | 'APPOINTMENT_CONFLICT'
  | 'APPOINTMENT_BLOCKED_BY_EXCEPTION'
  | 'APPOINTMENT_OUTSIDE_AVAILABILITY';

export type AppointmentErrorDetails = Readonly<Record<string, unknown>>;

/** Error de dominio con código estable; el filtro global de C-01 publica `code` y `details`. */
export class AppointmentError extends HttpException {
  readonly code: AppointmentErrorCode;
  readonly details: AppointmentErrorDetails | undefined;

  constructor(code: AppointmentErrorCode, message: string, status: HttpStatus, details?: AppointmentErrorDetails) {
    super({ code, message, ...(details ? { details } : {}) }, status);
    this.code = code;
    this.details = details;
  }
}

export type ReferenceField = 'pacienteId' | 'prestacionId' | 'sillonId';
export type ReferenceProblem = 'INEXISTENTE' | 'INACTIVO';

const REFERENCE_MESSAGES: Record<ReferenceField, Record<ReferenceProblem, string>> = {
  pacienteId: { INEXISTENTE: 'El paciente no existe', INACTIVO: 'El paciente está inactivo' },
  prestacionId: { INEXISTENTE: 'La prestación no existe', INACTIVO: 'La prestación está inactiva' },
  sillonId: { INEXISTENTE: 'El sillón no existe', INACTIVO: 'El sillón está inactivo' },
};

export const invalidTime = (): AppointmentError =>
  new AppointmentError(
    'APPOINTMENT_INVALID_TIME',
    'La fecha y hora no corresponden a un horario válido en la zona del consultorio',
    HttpStatus.BAD_REQUEST,
  );

export const referenceInvalid = (campo: ReferenceField, motivo: ReferenceProblem): AppointmentError =>
  new AppointmentError(
    'APPOINTMENT_REFERENCE_INVALID',
    REFERENCE_MESSAGES[campo][motivo],
    HttpStatus.UNPROCESSABLE_ENTITY,
    { campo, motivo },
  );

export const startsInPast = (): AppointmentError =>
  new AppointmentError('APPOINTMENT_IN_PAST', 'No se pueden crear turnos con inicio en el pasado', HttpStatus.UNPROCESSABLE_ENTITY);

/** Detalles sin datos del paciente: solo identificadores, sillón e instantes. */
export const scheduleConflict = (report: ConflictReport): AppointmentError =>
  new AppointmentError(
    'APPOINTMENT_CONFLICT',
    report.scope === 'SILLON'
      ? 'El sillón ya está ocupado en ese horario'
      : 'Ya hay otro turno del odontólogo en ese horario',
    HttpStatus.CONFLICT,
    {
      alcance: report.scope,
      conflictos: report.conflicts.map((conflict) => ({
        turnoId: conflict.id,
        sillonId: conflict.chairId,
        inicio: conflict.startsAt.toISOString(),
        finBloqueo: conflict.blockEndsAt.toISOString(),
      })),
    },
  );

export const blockedByException = (tipoExcepcion: string | null, motivoExcepcion: string | null): AppointmentError =>
  new AppointmentError(
    'APPOINTMENT_BLOCKED_BY_EXCEPTION',
    'La fecha está bloqueada por una excepción de disponibilidad',
    HttpStatus.CONFLICT,
    { tipoExcepcion, motivoExcepcion },
  );

export const outsideAvailability = (period: BlockedPeriod): AppointmentError =>
  new AppointmentError(
    'APPOINTMENT_OUTSIDE_AVAILABILITY',
    'El horario está fuera de la disponibilidad; confirmá la excepción con un motivo para continuar',
    HttpStatus.CONFLICT,
    { requiereOverrideManual: true, inicio: period.startsAt.toISOString(), finAtencion: period.careEndsAt.toISOString() },
  );
