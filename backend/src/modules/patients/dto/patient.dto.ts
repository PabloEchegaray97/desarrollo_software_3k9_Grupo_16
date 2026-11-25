import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { AppointmentStatus } from '../../appointments/core/domain/appointment-status.js';
import {
  normalizeDni,
  normalizeEmail,
  normalizeTextOrValue,
  parseBooleanQuery,
} from '../patient-normalization.js';

/** Solo dígitos, espacios, `+`, `-` y paréntesis, con 6 a 20 dígitos en total. */
export const PHONE_PATTERN = /^(?=(?:\D*\d){6,20}\D*$)[0-9+()\- ]+$/;
export const DNI_PATTERN = /^\d{7,8}$/;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Usado para alta (POST) y reemplazo completo (PUT). */
export class PatientInputDto {
  @Transform(({ value }) => normalizeTextOrValue(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @Transform(({ value }) => normalizeTextOrValue(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(PHONE_PATTERN, {
    message: 'telefono must contain 6 to 20 digits and only digits, spaces, +, - or parentheses',
  })
  telefono: string;

  @Transform(({ value }) => normalizeDni(value))
  @IsOptional()
  @IsString()
  @Matches(DNI_PATTERN, { message: 'dni must contain 7 or 8 digits' })
  dni?: string | null;

  @Transform(({ value }) => normalizeEmail(value))
  @IsOptional()
  @IsString()
  @MaxLength(254)
  @IsEmail()
  email?: string | null;

  /** No se persiste: confirma una advertencia `PATIENT_POSSIBLE_DUPLICATE` previa. */
  @IsOptional()
  @IsBoolean()
  confirmarPosibleDuplicado?: boolean;
}

export class SetPatientActiveDto {
  @IsBoolean()
  activo: boolean;
}

export class PatientListQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeTextOrValue(value))
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Transform(({ value }) => parseBooleanQuery(value))
  @IsBoolean()
  incluirInactivos?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}

export interface PatientResponse {
  id: string;
  nombre: string;
  telefono: string;
  dni: string | null;
  email: string | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientAppointmentResponse {
  id: string;
  prestacion: { id: string; nombre: string };
  sillon: { id: string; nombre: string };
  estado: AppointmentStatus;
  inicio: Date;
  finAtencion: Date;
  duracionMinutos: number;
}

export interface PatientDetailResponse extends PatientResponse {
  resumen: {
    totalTurnos: number;
    confirmados: number;
    atendidos: number;
    cancelados: number;
    tasaCancelacion: number;
    ultimaAtencion: Date | null;
    prestacionMasFrecuente: string | null;
  };
  turnos: PatientAppointmentResponse[];
}

/** Datos mínimos de una coincidencia: sin teléfono, DNI ni email. */
export interface DuplicateCandidate {
  id: string;
  nombre: string;
  activo: boolean;
}

/** Forma de respuesta paginada de C-02; candidata a promoverse a `shared` en C-08. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
