import { ApiClientError } from '../../shared/api/client'

export interface AgendaProblem {
  /** `range`: la fecha pedida fue rechazada; `generic`: cualquier otra falla de la consulta. */
  kind: 'range' | 'generic'
  message: string
  requestId?: string
}

/** Traduce un error de `GET /api/agenda` a un mensaje claro. Nunca expone el cuerpo ni datos personales. */
export function describeAgendaError(error: unknown): AgendaProblem {
  if (error instanceof ApiClientError) {
    if (error.code === 'AGENDA_RANGE_INVALID') {
      return { kind: 'range', message: 'La fecha elegida no es válida. Elegí otra fecha.', requestId: error.requestId }
    }
    if (error.code === 'AGENDA_RANGE_TOO_LARGE') {
      return { kind: 'range', message: 'El rango elegido supera el máximo permitido. Elegí un día.', requestId: error.requestId }
    }
    return { kind: 'generic', message: 'No se pudo cargar la agenda. Reintentá en unos segundos.', requestId: error.requestId }
  }
  return { kind: 'generic', message: 'No se pudo cargar la agenda. Revisá tu conexión y reintentá.' }
}
