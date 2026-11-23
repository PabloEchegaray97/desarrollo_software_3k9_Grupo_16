import { HttpException, HttpStatus } from '@nestjs/common';

/** Códigos internos neutros; su publicación HTTP depende de CR-01. */
export type AvailabilityErrorCode =
  | 'VALIDATION_ERROR'
  | 'RANGOS_INCOMPATIBLES'
  | 'EXCEPCION_NO_ENCONTRADA'
  | 'VERSION_CONFLICT';

export class AvailabilityError extends HttpException {
  readonly code: AvailabilityErrorCode;

  constructor(code: AvailabilityErrorCode, message: string, status: HttpStatus) {
    super({ code, message }, status);
    this.code = code;
  }
}

export const errorDeValidacion = (message: string): AvailabilityError =>
  new AvailabilityError('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST);

export const rangosIncompatibles = (): AvailabilityError =>
  new AvailabilityError(
    'RANGOS_INCOMPATIBLES',
    'Los tramos del mismo día comparten minutos',
    HttpStatus.BAD_REQUEST,
  );

export const excepcionNoEncontrada = (): AvailabilityError =>
  new AvailabilityError('EXCEPCION_NO_ENCONTRADA', 'La excepción no existe', HttpStatus.NOT_FOUND);

export const versionConflicto = (): AvailabilityError =>
  new AvailabilityError(
    'VERSION_CONFLICT',
    'La agenda cambió; recargá y reintentá',
    HttpStatus.CONFLICT,
  );
