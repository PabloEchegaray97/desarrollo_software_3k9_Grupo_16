export interface AppointmentInput {
  pacienteId: string
  prestacionId: string
  sillonId: string
  /** Fecha local `YYYY-MM-DD` en America/Argentina/Buenos_Aires. */
  fecha: string
  /** Hora local `HH:mm`. */
  horaInicio: string
  duracionMinutos?: number
  intervaloPosteriorMinutos?: number
  fueraDisponibilidad?: boolean
  motivoExcepcion?: string
  sobreturno?: boolean
}

export interface Appointment {
  id: string
  pacienteId: string
  prestacionId: string
  sillonId: string
  estado: string
  /** Instantes ISO UTC decididos por el backend. */
  inicio: string
  finAtencion: string
  finBloqueo: string
  duracionMinutos: number
  intervaloPosteriorMinutos: number
  fueraDisponibilidad: boolean
  motivoExcepcion: string | null
  createdAt: string
}

export interface AgendaConfiguration {
  intervaloGlobalMinutos: number
  zonaHoraria: string
}

export interface ConflictItem {
  turnoId: string
  sillonId: string
  inicio: string
  finBloqueo: string
}

/** Resultado de presentar un rechazo del backend. La interfaz no decide: solo traduce. */
export type BookingProblem =
  | { kind: 'outside'; inicio: string; finAtencion: string }
  | { kind: 'conflict'; scope: 'SILLON' | 'ODONTOLOGO'; conflicts: ConflictItem[] }
  | { kind: 'blocked'; tipoExcepcion: string | null; motivoExcepcion: string | null }
  | { kind: 'fields'; fields: Partial<Record<BookingField, string>> }
  | { kind: 'generic'; message: string }

export type BookingField = 'pacienteId' | 'prestacionId' | 'sillonId' | 'fecha' | 'horaInicio' | 'duracionMinutos' | 'intervaloPosteriorMinutos' | 'motivoExcepcion'
