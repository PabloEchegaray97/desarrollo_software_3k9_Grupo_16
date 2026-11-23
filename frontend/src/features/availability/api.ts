import { apiRequest } from '../../shared/api/client'
import type { ExceptionCreateInput, ExceptionRecord, WeeklySaveInput, WeeklyScheduleResponse } from './types'

export const getWeeklySchedule = (): Promise<WeeklyScheduleResponse> =>
  apiRequest<WeeklyScheduleResponse>('/disponibilidad/semanales')

export const saveWeeklySchedule = (input: WeeklySaveInput): Promise<WeeklyScheduleResponse> =>
  apiRequest<WeeklyScheduleResponse>('/disponibilidad/semanales', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const getExceptions = (): Promise<ExceptionRecord[]> =>
  apiRequest<ExceptionRecord[]>('/disponibilidad/excepciones')

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
