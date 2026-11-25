export interface Patient {
  id: string
  nombre: string
  telefono: string
  dni: string | null
  email: string | null
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface PatientInput {
  nombre: string
  telefono: string
  dni: string | null
  email: string | null
  confirmarPosibleDuplicado?: boolean
}

export type PatientAppointmentStatus = 'PROGRAMADO' | 'CONFIRMADO' | 'ATENDIDO' | 'CANCELADO' | 'AUSENTE'

export interface PatientAppointment {
  id: string
  prestacion: { id: string; nombre: string }
  sillon: { id: string; nombre: string }
  estado: PatientAppointmentStatus
  inicio: string
  finAtencion: string
  duracionMinutos: number
}

export interface PatientProfile extends Patient {
  resumen: {
    totalTurnos: number
    confirmados: number
    atendidos: number
    cancelados: number
    tasaCancelacion: number
    ultimaAtencion: string | null
    prestacionMasFrecuente: string | null
  }
  turnos: PatientAppointment[]
}

/** Coincidencia mínima devuelta por `PATIENT_POSSIBLE_DUPLICATE`. */
export interface DuplicateCandidate {
  id: string
  nombre: string
  activo: boolean
}
