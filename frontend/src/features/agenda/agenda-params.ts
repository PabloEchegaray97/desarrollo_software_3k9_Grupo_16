import { APPOINTMENT_STATUSES, type AppointmentStatus } from './types'
import { isValidLocalDate, monthRange } from './time'

/** Estado de la vista que vive en la URL para poder recargar o compartir la agenda. */
export interface AgendaViewState {
  fecha: string
  sillonId?: string
  /** Estados marcados. Vacío = ninguno marcado (la interfaz avisa y no consulta). */
  estados: AppointmentStatus[]
  turnoId?: string
}

/** Valor de `estado` en la URL cuando no hay ningún estado marcado. */
const NO_STATUS = 'ninguno'

const isStatus = (value: string): value is AppointmentStatus =>
  (APPOINTMENT_STATUSES as readonly string[]).includes(value)

export function readViewState(params: URLSearchParams, today: string): AgendaViewState {
  const rawDate = params.get('fecha')
  const fecha = rawDate !== null && isValidLocalDate(rawDate) ? rawDate : today

  const rawStatuses = params.get('estado')
  let estados: AppointmentStatus[] = [...APPOINTMENT_STATUSES]
  if (rawStatuses === NO_STATUS) {
    estados = []
  } else if (rawStatuses) {
    const selected = new Set(rawStatuses.split(',').map((part) => part.trim()).filter(isStatus))
    // Valores desconocidos no se envían al backend: si ninguno es válido, se vuelve a "todos".
    if (selected.size > 0) estados = APPOINTMENT_STATUSES.filter((status) => selected.has(status))
  }

  const sillonId = params.get('sillon') || undefined
  const turnoId = params.get('turno') || undefined
  return { fecha, sillonId, estados, turnoId }
}

/** Solo escribe lo que difiere de los valores por defecto, para mantener la URL corta. */
export function writeViewState(state: AgendaViewState, today: string): URLSearchParams {
  const params = new URLSearchParams()
  if (state.fecha !== today) params.set('fecha', state.fecha)
  if (state.sillonId) params.set('sillon', state.sillonId)
  if (state.estados.length === 0) params.set('estado', NO_STATUS)
  else if (state.estados.length < APPOINTMENT_STATUSES.length) params.set('estado', state.estados.join(','))
  if (state.turnoId) params.set('turno', state.turnoId)
  return params
}

/** `null` cuando no hay nada que consultar (ningún estado marcado). */
export function toAgendaQuery(state: AgendaViewState) {
  if (state.estados.length === 0) return null
  return {
    ...monthRange(state.fecha),
    ...(state.sillonId ? { sillonId: state.sillonId } : {}),
    ...(state.estados.length < APPOINTMENT_STATUSES.length ? { estado: state.estados } : {}),
  }
}

export const isDefaultFilters = (state: AgendaViewState): boolean =>
  !state.sillonId && state.estados.length === APPOINTMENT_STATUSES.length
