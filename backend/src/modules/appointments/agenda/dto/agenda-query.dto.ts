import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '../../core/domain/appointment-status.js';

/** Fecha local `YYYY-MM-DD`. Que exista en el calendario lo decide `resolveAgendaRange`. */
export const AGENDA_LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/** `estado=A,B` (o `estado=A&estado=B`) se convierte en lista; un valor vacío queda como `''` y falla la validación. */
function toStatusList(value: unknown): unknown {
  const split = (item: unknown): unknown[] =>
    typeof item === 'string' ? item.split(',').map((part) => part.trim()) : [item];
  if (Array.isArray(value)) {
    return value.flatMap(split);
  }
  return typeof value === 'string' ? split(value) : value;
}

/** Parámetros de `GET /api/agenda`. Los parámetros no documentados los rechaza el `ValidationPipe` global. */
export class AgendaQueryDto {
  @Matches(AGENDA_LOCAL_DATE)
  desde: string;

  @IsOptional()
  @Matches(AGENDA_LOCAL_DATE)
  hasta?: string;

  @IsOptional()
  @IsUUID()
  sillonId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStatusList(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(APPOINTMENT_STATUSES, { each: true })
  estado?: AppointmentStatus[];
}

export class UpcomingAgendaQueryDto {
  @Matches(AGENDA_LOCAL_DATE)
  desde: string;

  @IsOptional()
  @IsUUID()
  sillonId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStatusList(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(APPOINTMENT_STATUSES, { each: true })
  estado?: AppointmentStatus[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  todosEstados?: boolean;
}
