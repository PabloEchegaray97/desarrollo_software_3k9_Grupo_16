import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateIf } from 'class-validator';
import {
  EXCEPTION_REASON_MAX,
  LOCAL_DATE_PATTERN,
  LOCAL_TIME_PATTERN,
} from '../../creation/dto/create-appointment.dto.js';

/** Recorta extremos y colapsa espacios, tabulaciones y saltos en un único espacio (P1-04). */
export const normalizeReason = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : value;

export const REASON_LENGTH_MESSAGE = 'El motivo de la reprogramación es obligatorio (1–500 caracteres).';

/** Coordenadas locales; la validez real de la fecha la decide la evaluación de C-03. */
export class RescheduleAppointmentDto {
  @IsString()
  @Matches(LOCAL_DATE_PATTERN, { message: 'fecha must use the YYYY-MM-DD local format' })
  fecha: string;

  @IsString()
  @Matches(LOCAL_TIME_PATTERN, { message: 'horaInicio must use the HH:mm local 24h format' })
  horaInicio: string;

  @IsOptional()
  @IsUUID()
  sillonId?: string;

  @Transform(normalizeReason)
  @IsString()
  @IsNotEmpty({ message: REASON_LENGTH_MESSAGE })
  @MaxLength(EXCEPTION_REASON_MAX, { message: REASON_LENGTH_MESSAGE })
  motivo: string;

  @IsOptional()
  @IsBoolean()
  fueraDisponibilidad?: boolean;

  @ValidateIf((input: RescheduleAppointmentDto) => input.fueraDisponibilidad === true)
  @Transform(normalizeReason)
  @IsString()
  @IsNotEmpty()
  @MaxLength(EXCEPTION_REASON_MAX)
  motivoExcepcion?: string;
}
