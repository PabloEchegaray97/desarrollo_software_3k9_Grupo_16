import { vi } from 'vitest'

export interface RecordedRequest {
  method: string
  path: string
  body: unknown
}

type Handler = (request: RecordedRequest) => { status: number; body: unknown }

/** `fetch` simulado: cada llamada se resuelve con el primer handler cuyo prefijo `MÉTODO /ruta` coincide. */
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
    if (!route) return new Response(JSON.stringify({ error: { code: 'HTTP_404', message: 'Not mocked', requestId: 'test' } }), { status: 404 })
    const { status, body } = route[1](request)
    return new Response(JSON.stringify(body), { status })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { requests }
}

export const page = <T>(items: T[]) => ({ items, page: 1, pageSize: 20, total: items.length })

export const apiError = (status: number, code: string, message: string, details?: unknown) => ({
  status,
  body: { error: { code, message, requestId: 'request-test', ...(details === undefined ? {} : { details }) } },
})
