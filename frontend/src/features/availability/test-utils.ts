import { vi } from 'vitest'

export interface RecordedRequest {
  method: string
  path: string
  body: unknown
}

type Handler = (request: RecordedRequest) => { status: number; body: unknown }

/** `fetch` simulado para la feature; registra método, ruta y cuerpo de cada llamada. */
export function mockApi(routes: Array<[string, Handler]>) {
  const requests: RecordedRequest[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const request: RecordedRequest = {
      method: init?.method ?? 'GET',
      path: `${url.pathname.replace(/^\/api/, '')}${url.search}`,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    requests.push(request)
    const route = routes.find(([key]) => `${request.method} ${request.path}`.startsWith(key))
    if (!route) return new Response(JSON.stringify({ error: { code: 'HTTP_404', message: 'Ruta no simulada', requestId: 'test' } }), { status: 404 })
    const { status, body } = route[1](request)
    return new Response(JSON.stringify(body), { status })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { requests }
}

export const apiError = (status: number, code: string, message: string, details?: unknown) => ({
  status,
  body: { error: { code, message, requestId: 'request-test', ...(details === undefined ? {} : { details }) } },
})

export const weeklyResponse = (tramos: Array<{ diaSemana: number; horaInicio: string; horaFin: string }>, version = 'version-1') => ({ tramos, version })
