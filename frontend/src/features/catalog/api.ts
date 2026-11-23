import { apiRequest } from '../../shared/api/client'
import type { Paginated } from './ui/list'
import type { CatalogListParams, Chair, ChairInput, Procedure, ProcedureInput } from './types'

export function toQueryString(params: CatalogListParams): string {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.incluirInactivos) search.set('incluirInactivos', 'true')
  if (params.page && params.page > 1) search.set('page', String(params.page))
  if (params.pageSize) search.set('pageSize', String(params.pageSize))
  const value = search.toString()
  return value ? `?${value}` : ''
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })

export const proceduresApi = {
  list: (params: CatalogListParams, signal?: AbortSignal) =>
    apiRequest<Paginated<Procedure>>(`/prestaciones${toQueryString(params)}`, { signal }),
  create: (input: ProcedureInput) => apiRequest<Procedure>('/prestaciones', { method: 'POST', ...json(input) }),
  replace: (id: string, input: ProcedureInput) =>
    apiRequest<Procedure>(`/prestaciones/${encodeURIComponent(id)}`, { method: 'PUT', ...json(input) }),
  setActive: (id: string, activo: boolean) =>
    apiRequest<Procedure>(`/prestaciones/${encodeURIComponent(id)}/estado`, { method: 'PATCH', ...json({ activo }) }),
}

export const chairsApi = {
  list: (params: CatalogListParams, signal?: AbortSignal) =>
    apiRequest<Paginated<Chair>>(`/sillones${toQueryString(params)}`, { signal }),
  create: (input: ChairInput) => apiRequest<Chair>('/sillones', { method: 'POST', ...json(input) }),
  replace: (id: string, input: ChairInput) =>
    apiRequest<Chair>(`/sillones/${encodeURIComponent(id)}`, { method: 'PUT', ...json(input) }),
  setActive: (id: string, activo: boolean) =>
    apiRequest<Chair>(`/sillones/${encodeURIComponent(id)}/estado`, { method: 'PATCH', ...json({ activo }) }),
}
