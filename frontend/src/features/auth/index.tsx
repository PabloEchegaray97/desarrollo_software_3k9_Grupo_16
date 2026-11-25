import { Navigate, useLocation } from 'react-router-dom'
import { LoginForm } from './LoginForm'
import { useSession } from './session'

export const DEFAULT_DESTINATION = '/'

/** Solo acepta rutas internas para evitar redirecciones abiertas. */
export function safeDestination(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) return DEFAULT_DESTINATION
  const from = (state as { from: unknown }).from
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/acceso')) {
    return DEFAULT_DESTINATION
  }
  return from
}

export function AuthPage() {
  const { state, signIn } = useSession()
  const location = useLocation()

  if (state.status === 'authenticated') return <Navigate to={safeDestination(location.state)} replace />

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-card__brand"><span className="auth-card__mark" aria-hidden="true">O</span> OdoSoft</div>
      <h1 className="auth-card__title" id="auth-title">Ingresar</h1>
      <p className="auth-card__lead">Accedé con el email y la contraseña del consultorio.</p>
      <LoginForm onSuccess={signIn} />
    </section>
  )
}
