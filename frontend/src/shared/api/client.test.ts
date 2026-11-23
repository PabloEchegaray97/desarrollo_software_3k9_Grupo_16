import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './client'

describe('apiRequest', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns JSON and includes cookie credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiRequest<{ ok: boolean }>('/health')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/health'), expect.objectContaining({ credentials: 'include' }))
  })

  it('maps the shared API error contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', requestId: 'request-1234' } }), { status: 400 })))
    await expect(apiRequest('/patients')).rejects.toMatchObject({ name: 'ApiClientError', status: 400, code: 'VALIDATION_ERROR', requestId: 'request-1234' })
  })
})
