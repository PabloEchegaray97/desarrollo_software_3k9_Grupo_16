export const APPOINTMENT_STATUSES = ['PROGRAMADO', 'CONFIRMADO', 'ATENDIDO', 'CANCELADO', 'AUSENTE'] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export const APPOINTMENT_EVENT_TYPES = ['CREADO', 'REPROGRAMADO', 'CANCELADO', 'CAMBIO_ESTADO', 'EXCEPCION'] as const
export type AppointmentEventType = (typeof APPOINTMENT_EVENT_TYPES)[number]

/** Presentación únicamente: el backend sigue siendo la autoridad de la matriz y de la ventana temporal. */
export const TERMINAL_STATUSES: readonly AppointmentStatus[] = ['ATENDIDO', 'AUSENTE', 'CANCELADO']
export type ChangeableStatus = Extract<AppointmentStatus, 'CONFIRMADO' | 'ATENDIDO' | 'AUSENTE'>

/** Forma publicada por los cuatro endpoints de C-06 (design § Contratos HTTP). */
export interface LifecycleAppointment {
  id: string
  pacienteId: string
  prestacionId: string
  sillonId: string
  estado: AppointmentStatus
  inicio: string
  finAtencion: string
  finBloqueo: string
  duracionMinutos: number
  intervaloPosteriorMinutos: number
  fueraDisponibilidad: boolean
  motivoExcepcion: string | null
  motivoCancelacion: string | null
  createdAt: string
  updatedAt: string
}

/** Proyección P1-02: los campos no aplicables llegan `null`; nunca incluye datos de paciente. */
export interface LifecycleEvent {
  id: string
  tipo: AppointmentEventType
  ocurridoEn: string
  estadoAnterior: AppointmentStatus | null
  estadoNuevo: AppointmentStatus | null
  inicioAnterior: string | null
  inicioNuevo: string | null
  sillonAnteriorId: string | null
  sillonNuevoId: string | null
  motivo: string | null
}

export interface LifecycleResponse {
  turno: LifecycleAppointment
  historial: LifecycleEvent[]
}

export interface AppointmentHistoryResponse {
  turnoId: string
  eventos: LifecycleEvent[]
}

export interface RescheduleInput {
  fecha: string
  horaInicio: string
  sillonId?: string
  motivo: string
  fueraDisponibilidad?: boolean
  motivoExcepcion?: string
}

export interface CancelInput {
  motivo: string
}

export interface ChangeStatusInput {
  estado: ChangeableStatus
}

export type LifecycleErrorCode =
  | 'VALIDATION_ERROR'
  | 'APPOINTMENT_INVALID_TIME'
  | 'APPOINTMENT_NOT_FOUND'
  | 'APPOINTMENT_INVALID_TRANSITION'
  | 'APPOINTMENT_CONFLICT'
  | 'APPOINTMENT_OUTSIDE_AVAILABILITY'
  | 'APPOINTMENT_BLOCKED_BY_EXCEPTION'
  | 'APPOINTMENT_REFERENCE_INVALID'
  | 'APPOINTMENT_TOO_EARLY'

export type LifecycleField = 'motivo' | 'motivoExcepcion' | 'fecha' | 'horaInicio' | 'sillonId'

/** Resultado de traducir un rechazo: nunca contiene el mensaje ni los datos recibidos del servidor. */
export type LifecycleProblem =
  | { kind: 'field'; field: LifecycleField; message: string }
  | { kind: 'conflict'; message: string }
  | { kind: 'outside'; message: string; inicio: string; finAtencion: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'transition'; message: string }
  | { kind: 'notFound'; message: string }
  | { kind: 'tooEarly'; message: string }
  | { kind: 'generic'; message: string }
