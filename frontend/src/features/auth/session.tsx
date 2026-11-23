import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { ApiClientError } from '../../shared/api/client'
import { fetchSession, logout } from './api'
import type { SessionUser } from './types'

export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'anonymous' }
  | { status: 'error' }

interface SessionContextValue {
  state: SessionState
  /** Vuelve a consultar la sesión mostrando el estado de carga (reintento). */
  refresh: () => Promise<void>
  signIn: (user: SessionUser) => void
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

const isUnauthorized = (error: unknown) => error instanceof ApiClientError && error.status === 401

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  const check = useCallback(async (showLoading: boolean) => {
    if (showLoading) setState({ status: 'loading' })
    try {
      const { usuario } = await fetchSession()
      setState({ status: 'authenticated', user: usuario })
    } catch (error) {
      if (isUnauthorized(error)) {
        setState({ status: 'anonymous' })
      } else {
        setState((previous) => (!showLoading && previous.status === 'authenticated' ? previous : { status: 'error' }))
      }
    }
  }, [])

  useEffect(() => {
    void check(false)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check(false)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [check])

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      refresh: () => check(true),
      signIn: (user) => setState({ status: 'authenticated', user }),
      signOut: async () => {
        try {
          await logout()
        } finally {
          setState({ status: 'anonymous' })
        }
      },
    }),
    [state, check],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession debe usarse dentro de SessionProvider')
  return context
}
