import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimmedStringOrValue } from '../catalog-normalization.js';

export const PROCEDURE_DURATION_MIN = 1;
export const PROCEDURE_DURATION_MAX = 240;
export const PROCEDURE_INTERVAL_MIN = 0;
export const PROCEDURE_INTERVAL_MAX = 30;

/** Usado para alta (POST) y reemplazo completo (PUT). */
export class ProcedureInputDto {
  @Transform(({ value }) => trimmedStringOrValue(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsInt()
  @Min(PROCEDURE_DURATION_MIN)
  @Max(PROCEDURE_DURATION_MAX)
  duracionPredeterminadaMinutos: number;

  /** `null` u omitido: se aplica el intervalo global (C-03). */
  @IsOptional()
  @IsInt()
  @Min(PROCEDURE_INTERVAL_MIN)
  @Max(PROCEDURE_INTERVAL_MAX)
  intervaloPosteriorMinutos?: number | null;
}

/** Usado para alta (POST) y reemplazo completo (PUT). */
export class ChairInputDto {
  @Transform(({ value }) => trimmedStringOrValue(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;
}

export class SetActiveDto {
  @IsBoolean()
  activo: boolean;
}

export interface ProcedureResponse {
  id: string;
  nombre: string;
  duracionPredeterminadaMinutos: number;
  intervaloPosteriorMinutos: number | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChairResponse {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}
