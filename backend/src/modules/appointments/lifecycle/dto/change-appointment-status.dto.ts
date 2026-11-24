import { IsIn } from 'class-validator';

/** `CANCELADO` y `PROGRAMADO` quedan fuera: cancelar exige motivo y reprogramar tiene su ruta. */
export const MANUAL_STATUSES = ['CONFIRMADO', 'ATENDIDO', 'AUSENTE'] as const;
export type ManualAppointmentStatus = (typeof MANUAL_STATUSES)[number];

export class ChangeAppointmentStatusDto {
  @IsIn(MANUAL_STATUSES, { message: 'estado must be CONFIRMADO, ATENDIDO or AUSENTE' })
  estado: ManualAppointmentStatus;
}
