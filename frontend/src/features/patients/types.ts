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

/** Coincidencia mínima devuelta por `PATIENT_POSSIBLE_DUPLICATE`. */
export interface DuplicateCandidate {
  id: string
  nombre: string
  activo: boolean
}
