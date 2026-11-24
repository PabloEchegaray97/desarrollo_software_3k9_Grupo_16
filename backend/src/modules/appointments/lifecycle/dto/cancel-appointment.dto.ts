import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { EXCEPTION_REASON_MAX } from '../../creation/dto/create-appointment.dto.js';
import { normalizeReason } from './reschedule-appointment.dto.js';

export const CANCELLATION_REASON_MESSAGE = 'El motivo de la cancelación es obligatorio (1–500 caracteres).';

/** El único modo de llegar a `CANCELADO` (RN-TU-14): exige motivo normalizado. */
export class CancelAppointmentDto {
  @Transform(normalizeReason)
  @IsString()
  @IsNotEmpty({ message: CANCELLATION_REASON_MESSAGE })
  @MaxLength(EXCEPTION_REASON_MAX, { message: CANCELLATION_REASON_MESSAGE })
  motivo: string;
}
