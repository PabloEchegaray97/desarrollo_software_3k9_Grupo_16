import { HttpException, HttpStatus } from '@nestjs/common';
import type { AppointmentStatus } from '../core/domain/appointment-status.js';
import type { BlockedPeriod, ConflictReport } from '../core/domain/appointment-policy.js';

/** Códigos neutrales del contrato HTTP de C-06 (design § Contratos HTTP). */
export type LifecycleErrorCode =
  | 'VALIDATION_ERROR'
  | 'APPOINTMENT_INVALID_TIME'
  | 'APPOINTMENT_NOT_FOUND'
  | 'APPOINTMENT_INVALID_TRANSITION'
  | 'APPOINTMENT_CONFLICT'
  | 'APPOINTMENT_OUTSIDE_AVAILABILITY'
  | 'APPOINTMENT_BLOCKED_BY_EXCEPTION'
  | 'APPOINTMENT_REFERENCE_INVALID'
  | 'APPOINTMENT_TOO_EARLY';

export type LifecycleOperation = 'REPROGRAMAR' | 'CANCELAR' | 'CAMBIAR_ESTADO';
export type LifecycleErrorDetails = Readonly<Record<string, unknown>>;

export interface LifecycleErrorPayload {
  code: LifecycleErrorCode;
  message: string;
  details?: LifecycleErrorDetails;
}

/** El filtro global de C-01 publica `code`, `message` y `details` sin datos personales. */
export class LifecycleError extends HttpException {
  readonly code: LifecycleErrorCode;
  readonly details: LifecycleErrorDetails | undefined;

  constructor(code: LifecycleErrorCode, message: string, status: HttpStatus, details?: LifecycleErrorDetails) {
    super({ code, message, ...(details ? { details } : {}) }, status);
    this.code = code;
    this.details = details;
  }
}

export const validationError = (campo: string, message: string): LifecycleError =>
  new LifecycleError('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST, { campo });

export const invalidTime = (): LifecycleError =>
  new LifecycleError(
    'APPOINTMENT_INVALID_TIME',
    'La fecha y hora no corresponden a un horario válido en la zona del consultorio',
    HttpStatus.BAD_REQUEST,
  );

export const appointmentNotFound = (): LifecycleError =>
  new LifecycleError('APPOINTMENT_NOT_FOUND', 'El turno no existe', HttpStatus.NOT_FOUND);

export const invalidTransition = (estadoActual: AppointmentStatus, operacion: LifecycleOperation): LifecycleError =>
  new LifecycleError(
    'APPOINTMENT_INVALID_TRANSITION',
    'El estado actual del turno no permite esta operación',
    HttpStatus.CONFLICT,
    { estadoActual, operacion },
  );

/**
 * Misma forma de `details` que C-05: alcance, IDs de turno/sillón e instantes UTC.
 * Nunca incluye paciente, prestación clínica ni datos de contacto.
 */
export const scheduleConflict = (report: ConflictReport): LifecycleError =>
  new LifecycleError(
    'APPOINTMENT_CONFLICT',
    report.scope === 'SILLON' ? 'El sillón ya está ocupado en ese horario' : 'Ya hay otro turno en ese horario',
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

export const outsideAvailability = (period: BlockedPeriod): LifecycleError =>
  new LifecycleError(
    'APPOINTMENT_OUTSIDE_AVAILABILITY',
    'El horario está fuera de la disponibilidad; confirmá la excepción con un motivo para continuar',
    HttpStatus.CONFLICT,
    { requiereOverrideManual: true, inicio: period.startsAt.toISOString(), finAtencion: period.careEndsAt.toISOString() },
  );

export const blockedByException = (tipoExcepcion: string | null, motivoExcepcion: string | null): LifecycleError =>
  new LifecycleError(
    'APPOINTMENT_BLOCKED_BY_EXCEPTION',
    'La fecha está bloqueada por una excepción de disponibilidad',
    HttpStatus.CONFLICT,
    { tipoExcepcion, motivoExcepcion },
  );

export const referenceInvalid = (campo: 'sillonId', motivo: 'INEXISTENTE' | 'INACTIVO'): LifecycleError =>
  new LifecycleError(
    'APPOINTMENT_REFERENCE_INVALID',
    motivo === 'INEXISTENTE' ? 'El sillón no existe' : 'El sillón está inactivo',
    HttpStatus.UNPROCESSABLE_ENTITY,
    { campo, motivo },
  );

export const tooEarly = (inicio: Date, ahora: Date): LifecycleError =>
  new LifecycleError(
    'APPOINTMENT_TOO_EARLY',
    'La atención o ausencia no puede registrarse antes del inicio del turno',
    HttpStatus.UNPROCESSABLE_ENTITY,
    { inicio: inicio.toISOString(), ahora: ahora.toISOString() },
  );
