export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    requestId: string
    details?: Readonly<Record<string, unknown>> | readonly string[]
  }
}

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string
  readonly details?: ApiErrorPayload['error']['details']

  constructor(message: string, status: number, code: string, requestId: string, details?: ApiErrorPayload['error']['details']) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.requestId = requestId
    this.details = details
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const apiError = payload as ApiErrorPayload
    throw new ApiClientError(apiError.error.message, response.status, apiError.error.code, apiError.error.requestId, apiError.error.details)
  }
  return payload as T
}
