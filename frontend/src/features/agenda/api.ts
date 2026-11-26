import { apiRequest } from '../../shared/api/client'
import type { AgendaQuery, AgendaResponse, ChairOption, UpcomingAgendaResponse } from './types'

/** Serializa la consulta tal como la define `GET /api/agenda` (estados separados por comas). */
export function toAgendaQueryString(query: AgendaQuery): string {
  const search = new URLSearchParams({ desde: query.desde })
  if (query.hasta) search.set('hasta', query.hasta)
  if (query.sillonId) search.set('sillonId', query.sillonId)
  if (query.estado && query.estado.length > 0) search.set('estado', query.estado.join(','))
  return search.toString()
}

export interface UpcomingAgendaQuery {
  desde: string
  sillonId?: string
  estado?: AgendaQuery['estado']
  todosEstados?: boolean
}

export const agendaApi = {
  get: (query: AgendaQuery, signal?: AbortSignal) =>
    apiRequest<AgendaResponse>(`/agenda?${toAgendaQueryString(query)}`, { signal }),
  getUpcoming: (desdeOrQuery: string | UpcomingAgendaQuery, signal?: AbortSignal) => {
    const query = typeof desdeOrQuery === 'string' ? { desde: desdeOrQuery } : desdeOrQuery
    const search = new URLSearchParams({ desde: query.desde })
    if (query.sillonId) search.set('sillonId', query.sillonId)
    if (query.estado && query.estado.length > 0) search.set('estado', query.estado.join(','))
    if (query.todosEstados) search.set('todosEstados', 'true')
    return apiRequest<UpcomingAgendaResponse>(`/agenda/proximos?${search.toString()}`, { signal })
  },
}

interface ChairPage {
  items: ChairOption[]
}

/** Sillones de C-02. Incluye inactivos porque pueden conservar turnos históricos. */
export const listChairs = async (signal?: AbortSignal): Promise<ChairOption[]> => {
  const result = await apiRequest<ChairPage>('/sillones?incluirInactivos=true&pageSize=100', { signal })
  return result.items
}
