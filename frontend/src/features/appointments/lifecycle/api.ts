import { apiRequest } from '../../../shared/api/client'
import type {
  AppointmentHistoryResponse,
  CancelInput,
  ChangeStatusInput,
  LifecycleResponse,
  RescheduleInput,
} from './types'

/** Los cuatro endpoints de C-06. Ningún cálculo de disponibilidad ocurre en el cliente. */
export const lifecycleApi = {
  getAppointment: (id: string, signal?: AbortSignal) =>
    apiRequest<LifecycleResponse>(`/turnos/${encodeURIComponent(id)}`, { signal }),
  getHistory: (id: string, signal?: AbortSignal) =>
    apiRequest<AppointmentHistoryResponse>(`/turnos/${encodeURIComponent(id)}/historial`, { signal }),
  reschedule: (id: string, input: RescheduleInput) =>
    apiRequest<LifecycleResponse>(`/turnos/${encodeURIComponent(id)}/reprogramar`, { method: 'PATCH', body: JSON.stringify(input) }),
  cancel: (id: string, input: CancelInput) =>
    apiRequest<LifecycleResponse>(`/turnos/${encodeURIComponent(id)}/cancelar`, { method: 'PATCH', body: JSON.stringify(input) }),
  changeStatus: (id: string, input: ChangeStatusInput) =>
    apiRequest<LifecycleResponse>(`/turnos/${encodeURIComponent(id)}/estado`, { method: 'PATCH', body: JSON.stringify(input) }),
}
