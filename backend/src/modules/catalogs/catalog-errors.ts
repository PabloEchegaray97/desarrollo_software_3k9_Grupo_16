import { HttpException, HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

export type CatalogErrorCode =
  | 'PROCEDURE_NOT_FOUND'
  | 'PROCEDURE_NAME_CONFLICT'
  | 'CHAIR_NOT_FOUND'
  | 'CHAIR_NAME_CONFLICT';

/** Error de dominio con código estable; el filtro global lo publica tras CR-01. */
export class CatalogError extends HttpException {
  readonly code: CatalogErrorCode;

  constructor(code: CatalogErrorCode, message: string, status: HttpStatus) {
    super({ code, message }, status);
    this.code = code;
  }
}

export const procedureNotFound = (): CatalogError =>
  new CatalogError('PROCEDURE_NOT_FOUND', 'La prestación no existe', HttpStatus.NOT_FOUND);

export const procedureNameConflict = (): CatalogError =>
  new CatalogError(
    'PROCEDURE_NAME_CONFLICT',
    'Ya existe una prestación con ese nombre; si está inactiva, reactivala',
    HttpStatus.CONFLICT,
  );

export const chairNotFound = (): CatalogError =>
  new CatalogError('CHAIR_NOT_FOUND', 'El sillón no existe', HttpStatus.NOT_FOUND);

export const chairNameConflict = (): CatalogError =>
  new CatalogError(
    'CHAIR_NAME_CONFLICT',
    'Ya existe un sillón con ese nombre; si está inactivo, reactivalo',
    HttpStatus.CONFLICT,
  );

const MARIADB_DUPLICATE_ENTRY = 1062;

export function isDuplicateEntryError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'errno' in driverError &&
    driverError.errno === MARIADB_DUPLICATE_ENTRY
  );
}
