import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  APPOINTMENT_DURATION_MAX,
  APPOINTMENT_DURATION_MIN,
  APPOINTMENT_INTERVAL_MAX,
  APPOINTMENT_INTERVAL_MIN,
} from '../../core/domain/appointment-status.js';

/** Fecha de calendario local; la validez real (p. ej. 2027-02-30) la decide la evaluación de C-03. */
export const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Hora local de 24 h. */
export const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const EXCEPTION_REASON_MAX = 500;

const trimmed = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateAppointmentDto {
  @IsUUID()
  pacienteId: string;

  @IsUUID()
  prestacionId: string;

  @IsUUID()
  sillonId: string;

  @IsString()
  @Matches(LOCAL_DATE_PATTERN, { message: 'fecha must use the YYYY-MM-DD local format' })
  fecha: string;

  @IsString()
  @Matches(LOCAL_TIME_PATTERN, { message: 'horaInicio must use the HH:mm local 24h format' })
  horaInicio: string;

  @IsOptional()
  @IsInt()
  @Min(APPOINTMENT_DURATION_MIN)
  @Max(APPOINTMENT_DURATION_MAX)
  duracionMinutos?: number;

  @IsOptional()
  @IsInt()
  @Min(APPOINTMENT_INTERVAL_MIN)
  @Max(APPOINTMENT_INTERVAL_MAX)
  intervaloPosteriorMinutos?: number;

  /** Confirmación explícita de turno fuera de la disponibilidad semanal (US-031). */
  @IsOptional()
  @IsBoolean()
  fueraDisponibilidad?: boolean;

  /** Sobreturno: anula restricciones de horario pasado, disponibilidad y superposición solo para hoy. */
  @IsOptional()
  @IsBoolean()
  sobreturno?: boolean;

  /** Obligatorio (1–500 caracteres tras recortar) solo cuando `fueraDisponibilidad` es `true`; si no, se ignora. */
  @ValidateIf((input: CreateAppointmentDto) => input.fueraDisponibilidad === true)
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(EXCEPTION_REASON_MAX)
  motivoExcepcion?: string;
}

export interface AppointmentResponse {
  id: string;
  pacienteId: string;
  prestacionId: string;
  sillonId: string;
  estado: string;
  inicio: string;
  finAtencion: string;
  finBloqueo: string;
  duracionMinutos: number;
  intervaloPosteriorMinutos: number;
  fueraDisponibilidad: boolean;
  motivoExcepcion: string | null;
  createdAt: string;
}
