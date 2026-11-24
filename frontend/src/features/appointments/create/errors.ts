import { ApiClientError } from '../../../shared/api/client'
import type { BookingField, BookingProblem, ConflictItem } from './types'

const GENERIC = 'No se pudo registrar el turno. Intentá de nuevo en unos segundos.'

const VALIDATION_MESSAGES: Record<BookingField, string> = {
  pacienteId: 'Elegí un paciente.',
  prestacionId: 'Elegí una prestación.',
  sillonId: 'Elegí un sillón.',
  fecha: 'Ingresá una fecha válida.',
  horaInicio: 'Ingresá una hora válida (HH:mm).',
  duracionMinutos: 'La duración debe ser un número entero entre 1 y 240 minutos.',
  intervaloPosteriorMinutos: 'El intervalo debe ser un número entero entre 0 y 30 minutos.',
  motivoExcepcion: 'Ingresá un motivo de hasta 500 caracteres.',
}

const REFERENCE_MESSAGES: Record<string, Record<string, string>> = {
  pacienteId: { INEXISTENTE: 'El paciente ya no existe. Elegí otro.', INACTIVO: 'El paciente está inactivo. Reactivalo o elegí otro.' },
  prestacionId: { INEXISTENTE: 'La prestación ya no existe. Elegí otra.', INACTIVO: 'La prestación está inactiva. Elegí otra.' },
  sillonId: { INEXISTENTE: 'El sillón ya no existe. Elegí otro.', INACTIVO: 'El sillón está inactivo. Elegí otro.' },
}

type Details = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Details => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)

function isConflictItem(value: unknown): value is ConflictItem {
  return isRecord(value) && typeof value.turnoId === 'string' && typeof value.sillonId === 'string' && typeof value.inicio === 'string' && typeof value.finBloqueo === 'string'
}

/** Traduce la respuesta del backend a algo presentable. Nunca infiere disponibilidad ni conflictos. */
export function toBookingProblem(error: unknown): BookingProblem {
  if (!(error instanceof ApiClientError)) return { kind: 'generic', message: GENERIC }
  const details = isRecord(error.details) ? error.details : {}

  switch (error.code) {
    case 'APPOINTMENT_OUTSIDE_AVAILABILITY':
      return { kind: 'outside', inicio: text(details.inicio) ?? '', finAtencion: text(details.finAtencion) ?? '' }
    case 'APPOINTMENT_CONFLICT':
      return {
        kind: 'conflict',
        scope: details.alcance === 'SILLON' ? 'SILLON' : 'ODONTOLOGO',
        conflicts: Array.isArray(details.conflictos) ? details.conflictos.filter(isConflictItem) : [],
      }
    case 'APPOINTMENT_BLOCKED_BY_EXCEPTION':
      return { kind: 'blocked', tipoExcepcion: text(details.tipoExcepcion), motivoExcepcion: text(details.motivoExcepcion) }
    case 'APPOINTMENT_REFERENCE_INVALID': {
      const campo = text(details.campo)
      const motivo = text(details.motivo) ?? 'INEXISTENTE'
      if (campo === 'pacienteId' || campo === 'prestacionId' || campo === 'sillonId') {
        return { kind: 'fields', fields: { [campo]: REFERENCE_MESSAGES[campo]?.[motivo] ?? error.message } }
      }
      return { kind: 'generic', message: error.message }
    }
    case 'APPOINTMENT_IN_PAST':
      return { kind: 'fields', fields: { horaInicio: 'Ese horario ya pasó. Elegí un inicio futuro.' } }
    case 'APPOINTMENT_INVALID_TIME':
      return { kind: 'fields', fields: { fecha: 'Esa fecha y hora no existen en la zona del consultorio.' } }
    case 'VALIDATION_ERROR': {
      const fields: Partial<Record<BookingField, string>> = {}
      const messages = Array.isArray(error.details) ? (error.details as readonly unknown[]).filter((item): item is string => typeof item === 'string') : []
      for (const message of messages) {
        const field = (Object.keys(VALIDATION_MESSAGES) as BookingField[]).find((candidate) => message.startsWith(`${candidate} `))
        if (field) fields[field] = VALIDATION_MESSAGES[field]
      }
      return Object.keys(fields).length > 0 ? { kind: 'fields', fields } : { kind: 'generic', message: GENERIC }
    }
    default:
      return { kind: 'generic', message: error.status >= 500 ? GENERIC : error.message }
  }
}

export const EXCEPTION_LABELS: Record<string, string> = {
  FERIADO: 'un feriado',
  VACACIONES: 'vacaciones',
  BLOQUEO: 'un bloqueo de agenda',
}
