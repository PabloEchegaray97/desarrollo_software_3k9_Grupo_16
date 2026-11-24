import { apiRequest } from '../../../shared/api/client'
import type { AgendaConfiguration, Appointment, AppointmentInput } from './types'

export const appointmentsApi = {
  create: (input: AppointmentInput) =>
    apiRequest<Appointment>('/turnos', { method: 'POST', body: JSON.stringify(input) }),
}

/** Configuración de C-03; solo se usa para mostrar el intervalo global como referencia. */
export const getAgendaConfiguration = (signal?: AbortSignal) =>
  apiRequest<AgendaConfiguration>('/disponibilidad/configuracion', { signal })
