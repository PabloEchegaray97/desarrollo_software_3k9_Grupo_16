import type { AppointmentResponse } from '../../creation/dto/create-appointment.dto.js';
import type { AppointmentEventType, AppointmentStatus } from '../../core/domain/appointment-status.js';

/** Forma de C-05 más los campos nuevos acordados para C-07/C-08 (design § Contratos HTTP). */
export interface LifecycleAppointmentResponse extends AppointmentResponse {
  estado: AppointmentStatus;
  motivoCancelacion: string | null;
  updatedAt: string;
}

/** Proyección autorizada por P1-02; el backend no expone nombres ni datos de pacientes. */
export interface LifecycleEventResponse {
  id: string;
  tipo: AppointmentEventType;
  ocurridoEn: string;
  estadoAnterior: AppointmentStatus | null;
  estadoNuevo: AppointmentStatus | null;
  inicioAnterior: string | null;
  inicioNuevo: string | null;
  sillonAnteriorId: string | null;
  sillonNuevoId: string | null;
  motivo: string | null;
}

export interface AppointmentLifecycleResponse {
  turno: LifecycleAppointmentResponse;
  historial: LifecycleEventResponse[];
}

export function toLifecycleResponse(
  turno: LifecycleAppointmentResponse,
  historial: readonly LifecycleEventResponse[],
): AppointmentLifecycleResponse {
  return { turno, historial: [...historial] };
}
