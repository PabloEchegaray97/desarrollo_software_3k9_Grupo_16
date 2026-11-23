import { useCallback, useEffect, useState } from 'react'
import type { Paginated } from './list'

export type RemoteListState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Paginated<T> }

/** Carga una página remota; descarta respuestas obsoletas y nunca deja promesas sin manejar. */
export function useRemoteList<T>(load: (signal: AbortSignal) => Promise<Paginated<T>>): { state: RemoteListState<T>; reload: () => void } {
  const [state, setState] = useState<RemoteListState<T>>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    load(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ status: 'ready', data }) },
      () => { if (!controller.signal.aborted) setState({ status: 'error', message: 'No se pudo cargar el listado. Revisá la conexión e intentá de nuevo.' }) },
    )
    return () => controller.abort()
  }, [load, version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])
  return { state, reload }
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
