import { vi } from 'vitest'

export const FICTIONAL_USER = { id: '7a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', email: 'odontologo.ficticio@example.test' }

export interface FakeResponse {
  status: number
  body?: unknown
}

type Handler = (init: RequestInit | undefined) => FakeResponse | Promise<FakeResponse>

export const unauthorized: FakeResponse = {
  status: 401,
  body: { error: { code: 'HTTP_401', message: 'Sesión requerida', requestId: 'req-ficticio' } },
}

export const serverError: FakeResponse = {
  status: 500,
  body: { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error', requestId: 'req-ficticio' } },
}

export const authenticated: FakeResponse = { status: 200, body: { usuario: FICTIONAL_USER } }

/** Simula `fetch` por sufijo de ruta (`/auth/sesion`, `/auth/login`, `/auth/logout`). */
export function mockApi(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const key = Object.keys(handlers).find((suffix) => url.endsWith(suffix))
    if (!key) throw new Error(`Ruta no simulada: ${url}`)
    const { status, body } = await handlers[key](init)
    return { ok: status < 400, status, json: async () => body } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export const callsTo = (fetchMock: ReturnType<typeof mockApi>, suffix: string) =>
  fetchMock.mock.calls.filter(([input]) => String(input).endsWith(suffix))
