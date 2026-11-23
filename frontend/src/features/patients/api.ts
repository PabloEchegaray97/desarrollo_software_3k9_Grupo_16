import { ApiClientError, apiRequest } from '../../shared/api/client'
import { toQueryString } from '../catalog/api'
import type { CatalogListParams } from '../catalog/types'
import type { Paginated } from '../catalog/ui/list'
import type { DuplicateCandidate, Patient, PatientInput } from './types'

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })

export const patientsApi = {
  list: (params: CatalogListParams, signal?: AbortSignal) =>
    apiRequest<Paginated<Patient>>(`/pacientes${toQueryString(params)}`, { signal }),
  create: (input: PatientInput) => apiRequest<Patient>('/pacientes', { method: 'POST', ...json(input) }),
  replace: (id: string, input: PatientInput) =>
    apiRequest<Patient>(`/pacientes/${encodeURIComponent(id)}`, { method: 'PUT', ...json(input) }),
  setActive: (id: string, activo: boolean) =>
    apiRequest<Patient>(`/pacientes/${encodeURIComponent(id)}/estado`, { method: 'PATCH', ...json({ activo }) }),
}

function isCandidate(value: unknown): value is DuplicateCandidate {
  return (
    typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'nombre' in value && typeof value.nombre === 'string' &&
    'activo' in value && typeof value.activo === 'boolean'
  )
}

/**
 * Si el error es una advertencia de posible duplicado devuelve sus candidatos
 * (posiblemente vacíos si el backend no los envía); si no, `null`.
 */
export function possibleDuplicateCandidates(error: unknown): DuplicateCandidate[] | null {
  if (!(error instanceof ApiClientError) || error.code !== 'PATIENT_POSSIBLE_DUPLICATE') return null
  const details = error.details
  if (!details || Array.isArray(details)) return []
  const candidates = (details as Readonly<Record<string, unknown>>).candidatos
  return Array.isArray(candidates) ? candidates.filter(isCandidate) : []
}
