import type { LifecycleEventResponse } from '../../lifecycle/dto/appointment-lifecycle-response.js';

/**
 * P1-02: la proyección del `GET` es la misma que la de las respuestas de mutación.
 * Se reutiliza el tipo para que no pueda divergir el contrato.
 */
export type AppointmentHistoryEventResponse = LifecycleEventResponse;

export interface AppointmentHistoryResponse {
  turnoId: string;
  eventos: AppointmentHistoryEventResponse[];
}
