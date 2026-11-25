/** Estados del turno (RN-TU-06). Es el mismo conjunto que publica el backend en `estado`. */
export const APPOINTMENT_STATUSES = ['PROGRAMADO', 'CONFIRMADO', 'ATENDIDO', 'CANCELADO', 'AUSENTE'] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

/** Referencia mínima a otra entidad: la interfaz nunca recibe ni muestra contacto o datos clínicos. */
export interface AgendaReference {
  id: string
  nombre: string
}

export interface AgendaTurno {
  id: string
  estado: AppointmentStatus
  /** Instantes ISO UTC decididos por el backend. */
  inicio: string
  finAtencion: string
  finBloqueo: string
  duracionMinutos: number
  intervaloPosteriorMinutos: number
  /** Lo decide el backend (RN-TU-07); la interfaz no lo deduce del estado. */
  bloqueaHorario: boolean
  fueraDisponibilidad: boolean
  motivoExcepcion: string | null
  paciente: AgendaReference
  prestacion: AgendaReference
  sillon: AgendaReference
}

export interface AgendaTramo {
  horaInicio: string
  horaFin: string
}

export interface AgendaBloqueo {
  id: string
  tipo: string
  motivo: string
  /** Ambas horas nulas indican un bloqueo de día completo. */
  horaInicio: string | null
  horaFin: string | null
}

export interface AgendaDia {
  fecha: string
  tramos: AgendaTramo[]
  bloqueos: AgendaBloqueo[]
}

export interface AgendaResponse {
  zonaHoraria: string
  desde: string
  hasta: string
  /** Hora del servidor en que se generaron los datos, ISO UTC. */
  generadoEn: string
  turnos: AgendaTurno[]
  dias: AgendaDia[]
}

export interface UpcomingAgendaResponse {
  zonaHoraria: string
  desde: string
  generadoEn: string
  turnos: AgendaTurno[]
}

/** Parámetros de `GET /api/agenda`. */
export interface AgendaQuery {
  desde: string
  hasta?: string
  sillonId?: string
  /** Sin valor = todos los estados. */
  estado?: AppointmentStatus[]
}

export interface ChairOption {
  id: string
  nombre: string
  activo: boolean
}
