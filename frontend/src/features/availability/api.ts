import { apiRequest } from '../../shared/api/client'
import type { AvailabilityConfiguration, ExceptionCreateInput, ExceptionRecord, WeeklySaveInput, WeeklyScheduleResponse } from './types'

export const getAvailabilityConfiguration = (signal?: AbortSignal): Promise<AvailabilityConfiguration> =>
  apiRequest<AvailabilityConfiguration>('/disponibilidad/configuracion', { signal })

export const saveAvailabilityConfiguration = (intervaloGlobalMinutos: number): Promise<AvailabilityConfiguration> =>
  apiRequest<AvailabilityConfiguration>('/disponibilidad/configuracion', {
    method: 'PATCH',
    body: JSON.stringify({ intervaloGlobalMinutos }),
  })

export const getWeeklySchedule = (signal?: AbortSignal): Promise<WeeklyScheduleResponse> =>
  apiRequest<WeeklyScheduleResponse>('/disponibilidad/semanales', { signal })

export const saveWeeklySchedule = (input: WeeklySaveInput): Promise<WeeklyScheduleResponse> =>
  apiRequest<WeeklyScheduleResponse>('/disponibilidad/semanales', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const getExceptions = (signal?: AbortSignal): Promise<ExceptionRecord[]> =>
  apiRequest<ExceptionRecord[]>('/disponibilidad/excepciones', { signal })

export const createException = (input: ExceptionCreateInput): Promise<ExceptionRecord> =>
  apiRequest<ExceptionRecord>('/disponibilidad/excepciones', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const cancelException = (id: string): Promise<ExceptionRecord> =>
  apiRequest<ExceptionRecord>(`/disponibilidad/excepciones/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ activo: false }),
  })
