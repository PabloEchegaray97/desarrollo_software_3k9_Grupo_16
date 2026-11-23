import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '../../features/auth/session'
import { StatePanel } from '../../shared/components/StatePanel'
import { authRoute } from '../routes/auth.routes'

/** Renderiza contenido protegido solo con sesión vigente. */
export function RequireSession({ children }: PropsWithChildren) {
  const { state, refresh } = useSession()
  const location = useLocation()

  if (state.status === 'authenticated') return <>{children}</>
  if (state.status === 'anonymous') {
    return <Navigate to={authRoute.path} replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return (
    <div className="shell-status">
      {state.status === 'loading' ? (
        <StatePanel state="loading" title="Verificando sesión" description="Un momento, estamos comprobando tu acceso." />
      ) : (
        <StatePanel
          state="error"
          title="No pudimos verificar la sesión"
          description="Revisá la conexión con el servidor e intentá nuevamente."
          actionLabel="Reintentar"
          onAction={() => void refresh()}
        />
      )}
    </div>
  )
}
