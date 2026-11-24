import { useCallback, useEffect, useRef, useState } from 'react'
import { agendaApi } from './api'
import { describeAgendaError, type AgendaProblem } from './errors'
import type { AgendaQuery, AgendaResponse } from './types'

export type AgendaLoad =
  /** No hay nada que consultar (por ejemplo, ningún estado marcado). */
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; problem: AgendaProblem }
  | {
      status: 'ready'
      data: AgendaResponse
      /** Hay un refresco en curso; los datos previos siguen visibles. */
      refreshing: boolean
      /** El último refresco falló; se conservan los datos previos. */
      refreshError: AgendaProblem | null
    }

/**
 * Consulta la agenda y expone un refresco explícito. Cambiar la consulta descarta los datos anteriores
 * (son de otro día o filtro); refrescar los conserva hasta que llegue la respuesta nueva.
 */
export function useAgenda(query: AgendaQuery | null) {
  const [load, setLoad] = useState<AgendaLoad>(query ? { status: 'loading' } : { status: 'idle' })
  const queryKey = query ? JSON.stringify(query) : ''
  const queryRef = useRef(query)
  queryRef.current = query
  const controllerRef = useRef<AbortController | null>(null)

  const run = useCallback(async (mode: 'initial' | 'refresh') => {
    const current = queryRef.current
    controllerRef.current?.abort()
    if (!current) {
      setLoad({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    setLoad((previous) =>
      mode === 'refresh' && previous.status === 'ready'
        ? { ...previous, refreshing: true, refreshError: null }
        : { status: 'loading' },
    )
    try {
      const data = await agendaApi.get(current, controller.signal)
      if (controller.signal.aborted) return
      setLoad({ status: 'ready', data, refreshing: false, refreshError: null })
    } catch (error) {
      if (controller.signal.aborted) return
      const problem = describeAgendaError(error)
      setLoad((previous) =>
        mode === 'refresh' && previous.status === 'ready'
          ? { ...previous, refreshing: false, refreshError: problem }
          : { status: 'error', problem },
      )
    }
  }, [])

  useEffect(() => {
    void run('initial')
    return () => controllerRef.current?.abort()
  }, [queryKey, run])

  const refresh = useCallback(() => run('refresh'), [run])
  /** Reintento tras un error de la carga inicial: vuelve a mostrar el estado de carga. */
  const retry = useCallback(() => run('initial'), [run])
  return { load, refresh, retry }
}
