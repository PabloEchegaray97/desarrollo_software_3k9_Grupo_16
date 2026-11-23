import { HttpException, HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { DuplicateCandidate } from './dto/patient.dto.js';

export type PatientErrorCode = 'PATIENT_NOT_FOUND' | 'PATIENT_DNI_CONFLICT' | 'PATIENT_POSSIBLE_DUPLICATE';

export interface PatientErrorDetails {
  candidatos: DuplicateCandidate[];
}

/** Error de dominio con código estable; el filtro global lo publica tras CR-01. */
export class PatientError extends HttpException {
  readonly code: PatientErrorCode;

  constructor(code: PatientErrorCode, message: string, status: HttpStatus, details?: PatientErrorDetails) {
    super({ code, message, ...(details ? { details } : {}) }, status);
    this.code = code;
  }
}

export const patientNotFound = (): PatientError =>
  new PatientError('PATIENT_NOT_FOUND', 'El paciente no existe', HttpStatus.NOT_FOUND);

export const patientDniConflict = (): PatientError =>
  new PatientError('PATIENT_DNI_CONFLICT', 'Ya existe un paciente con ese DNI', HttpStatus.CONFLICT);

export const patientPossibleDuplicate = (candidatos: DuplicateCandidate[]): PatientError =>
  new PatientError(
    'PATIENT_POSSIBLE_DUPLICATE',
    'Existe un paciente con el mismo nombre y teléfono; confirmá para continuar',
    HttpStatus.CONFLICT,
    { candidatos },
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
