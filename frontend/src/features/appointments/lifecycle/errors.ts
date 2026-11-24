import { ApiClientError } from '../../../shared/api/client'
import type { LifecycleField, LifecycleProblem } from './types'

const GENERIC = 'No se pudo completar la operación. Intentá de nuevo en unos segundos.'

const FIELD_MESSAGES: Readonly<Record<LifecycleField, string>> = {
  motivo: 'Ingresá un motivo de 1 a 500 caracteres.',
  motivoExcepcion: 'Ingresá el motivo de la excepción (1 a 500 caracteres).',
  fecha: 'Ingresá una fecha válida en la zona del consultorio.',
  horaInicio: 'Ingresá una hora válida (HH:mm).',
  sillonId: 'Elegí un sillón válido.',
}

const FIELD_CODES: readonly LifecycleField[] = ['motivo', 'motivoExcepcion', 'fecha', 'horaInicio', 'sillonId']

type Details = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Details =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Traduce códigos neutrales a mensajes fijos. Nunca interpola `message` ni `details` con datos personales. */
export function toLifecycleProblem(error: unknown): LifecycleProblem {
  if (!(error instanceof ApiClientError)) return { kind: 'generic', message: GENERIC }
  const details = isRecord(error.details) ? error.details : {}
  switch (error.code) {
    case 'VALIDATION_ERROR': {
      const campo = text(details.campo)
      const field = FIELD_CODES.find((candidate) => candidate === campo)
      return field ? { kind: 'field', field, message: FIELD_MESSAGES[field] } : { kind: 'generic', message: GENERIC }
    }
    case 'APPOINTMENT_INVALID_TIME':
      return { kind: 'field', field: 'fecha', message: 'Esa fecha y hora no existen en la zona del consultorio.' }
    case 'APPOINTMENT_REFERENCE_INVALID':
      return { kind: 'field', field: 'sillonId', message: 'El sillón ya no está disponible.' }
    case 'APPOINTMENT_NOT_FOUND':
      return { kind: 'notFound', message: 'El turno ya no existe.' }
    case 'APPOINTMENT_INVALID_TRANSITION':
      return { kind: 'transition', message: 'El estado actual del turno no permite esta operación.' }
    case 'APPOINTMENT_CONFLICT':
      return { kind: 'conflict', message: 'El horario ya está ocupado. Elegí otro horario.' }
    case 'APPOINTMENT_OUTSIDE_AVAILABILITY':
      return {
        kind: 'outside',
        message: 'El horario está fuera de la disponibilidad; confirmá la excepción con un motivo.',
        inicio: text(details.inicio),
        finAtencion: text(details.finAtencion),
      }
    case 'APPOINTMENT_BLOCKED_BY_EXCEPTION':
      return { kind: 'blocked', message: 'La fecha está bloqueada por una excepción de disponibilidad.' }
    case 'APPOINTMENT_TOO_EARLY':
      return { kind: 'tooEarly', message: 'La atención o ausencia no puede registrarse antes del inicio del turno.' }
    default:
      return { kind: 'generic', message: GENERIC }
  }
}
