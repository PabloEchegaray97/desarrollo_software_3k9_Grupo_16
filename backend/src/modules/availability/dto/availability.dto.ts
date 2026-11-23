import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const INTERVALO_MINIMO = 0;
export const INTERVALO_MAXIMO = 30;
export const HORA_LOCAL = /^([01]\d|2[0-3]):[0-5]\d$/;
export const FECHA_LOCAL = /^\d{4}-\d{2}-\d{2}$/;

/** La zona horaria del consultorio no es negociable: no se whitelistea en esta entrada. */
export class ConfiguracionPatchDto {
  @IsInt()
  @Min(INTERVALO_MINIMO)
  @Max(INTERVALO_MAXIMO)
  intervaloGlobalMinutos: number;
}

export interface ConfiguracionResponse {
  intervaloGlobalMinutos: number;
  zonaHoraria: string;
}

export class TramoSemanalDto {
  @IsInt()
  @Min(1)
  @Max(7)
  diaSemana: number;

  @Matches(HORA_LOCAL)
  horaInicio: string;

  @Matches(HORA_LOCAL)
  horaFin: string;
}

export class SemanalesPutDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TramoSemanalDto)
  tramos: TramoSemanalDto[];

  /** Versión opcional de la agenda leída por GET; se comprueba dentro de la transacción. */
  @IsOptional()
  @IsString()
  version?: string;
}

export interface TramoResponse {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface SemanalesResponse {
  tramos: TramoResponse[];
  version: string;
}

export class ExcepcionPostDto {
  @Matches(FECHA_LOCAL)
  fecha: string;

  @IsString()
  tipo: string;

  @IsString()
  motivo: string;

  @IsOptional()
  @Matches(HORA_LOCAL)
  horaInicio?: string;

  @IsOptional()
  @Matches(HORA_LOCAL)
  horaFin?: string;
}

export class ExcepcionEstadoPatchDto {
  @IsBoolean()
  activo: boolean;
}

export interface ExcepcionResponse {
  id: string;
  fecha: string;
  tipo: string;
  motivo: string;
  horaInicio: string | null;
  horaFin: string | null;
  activo: boolean;
  inicioUtc: string | null;
  finUtc: string | null;
}

export class EvaluacionPostDto {
  @Matches(FECHA_LOCAL)
  fecha: string;

  @Matches(HORA_LOCAL)
  horaInicio: string;

  /** 0 es admitido para que la política responda `DATOS_INVALIDOS` sin un 400 de DTO. */
  @IsInt()
  @Min(0)
  duracionMinutos: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  intervaloPosteriorMinutos?: number;
}

export type { ResultadoEvaluacion } from '../domain/availability-policy.js';
