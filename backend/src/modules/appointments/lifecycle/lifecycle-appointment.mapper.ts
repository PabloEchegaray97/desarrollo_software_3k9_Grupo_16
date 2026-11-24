import { toAppointmentResponse } from '../creation/create-appointment.service.js';
import type { AppointmentEntity } from '../core/entities/appointment.entity.js';
import type { LifecycleAppointmentResponse } from './dto/appointment-lifecycle-response.js';

/** Forma de C-05 más los campos acordados para el ciclo de vida (design § Contratos HTTP). */
export function toLifecycleAppointmentResponse(entity: AppointmentEntity): LifecycleAppointmentResponse {
  return {
    ...toAppointmentResponse(entity),
    estado: entity.status,
    motivoCancelacion: entity.cancellationReason,
    updatedAt: entity.updatedAt.toISOString(),
  };
}
