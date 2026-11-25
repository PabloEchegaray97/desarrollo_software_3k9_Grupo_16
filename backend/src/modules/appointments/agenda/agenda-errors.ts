import { HttpException, HttpStatus } from '@nestjs/common';
import { MAX_AGENDA_DAYS } from './domain/agenda-range.js';

export type AgendaErrorCode = 'AGENDA_RANGE_INVALID' | 'AGENDA_RANGE_TOO_LARGE' | 'AGENDA_CHAIR_NOT_FOUND';

export type AgendaErrorDetails = Readonly<Record<string, unknown>>;

/** Error de dominio con código estable; el filtro global publica `code` y `details`. */
export class AgendaError extends HttpException {
  readonly code: AgendaErrorCode;
  readonly details: AgendaErrorDetails | undefined;

  constructor(code: AgendaErrorCode, message: string, status: HttpStatus, details?: AgendaErrorDetails) {
    super({ code, message, ...(details ? { details } : {}) }, status);
    this.code = code;
    this.details = details;
  }
}

export const rangeInvalid = (): AgendaError =>
  new AgendaError(
    'AGENDA_RANGE_INVALID',
    'El rango de fechas no es válido: revisá que las fechas existan y que "desde" no sea posterior a "hasta"',
    HttpStatus.BAD_REQUEST,
  );

export const rangeTooLarge = (solicitadoDias: number): AgendaError =>
  new AgendaError(
    'AGENDA_RANGE_TOO_LARGE',
    `El rango supera el máximo de ${MAX_AGENDA_DAYS} días por consulta`,
    HttpStatus.BAD_REQUEST,
    { maximoDias: MAX_AGENDA_DAYS, solicitadoDias },
  );

export const chairNotFound = (): AgendaError =>
  new AgendaError('AGENDA_CHAIR_NOT_FOUND', 'El sillón indicado no existe', HttpStatus.UNPROCESSABLE_ENTITY, {
    campo: 'sillonId',
    motivo: 'INEXISTENTE',
  });
