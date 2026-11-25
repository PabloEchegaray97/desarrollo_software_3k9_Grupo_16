export interface WeeklySlot {
  diaSemana: number
  horaInicio: string
  horaFin: string
}

export interface WeeklyScheduleResponse {
  tramos: WeeklySlot[]
  version: string
}

export interface WeeklySaveInput {
  tramos: WeeklySlot[]
  version: string
}

export interface AvailabilityConfiguration {
  intervaloGlobalMinutos: number
  zonaHoraria: string
}

export type ExceptionKind = 'FERIADO' | 'VACACIONES' | 'BLOQUEO'

export interface ExceptionRecord {
  id: string
  fecha: string
  tipo: ExceptionKind
  motivo: string
  horaInicio: string | null
  horaFin: string | null
  activo: boolean
}

export interface ExceptionCreateInput {
  fecha: string
  tipo: ExceptionKind
  motivo: string
  horaInicio?: string
  horaFin?: string
}
