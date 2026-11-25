import { Navigate, useLocation } from 'react-router-dom'
import { CalendarCheck, Clock, ShieldCheck, Tooth } from '@phosphor-icons/react'
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
    <section className="auth-screen" aria-labelledby="auth-title">
      <aside className="auth-intro">
        <div className="auth-wordmark" aria-label="OdoSoft">
          <Tooth size={34} weight="fill" aria-hidden="true" />
          <span className="auth-wordmark__text">Odo<span>Soft</span></span>
        </div>
        <div className="auth-intro__copy">
          <h2>Tu consultorio, organizado en un solo lugar.</h2>
          <p>Gestioná pacientes, disponibilidad y turnos con una experiencia clara y segura.</p>
        </div>
        <ul className="auth-intro__features" aria-label="Funciones principales">
          <li><CalendarCheck size={18} aria-hidden="true" /><span>Agenda diaria sin solapamientos</span></li>
          <li><Clock size={18} aria-hidden="true" /><span>Disponibilidad e intervalos configurables</span></li>
          <li><ShieldCheck size={18} aria-hidden="true" /><span>Acceso privado para tu consultorio</span></li>
        </ul>
      </aside>

      <div className="auth-card">
        <div className="auth-card__heading">
          <h1 className="auth-card__title" id="auth-title">Ingresar</h1>
          <p className="auth-card__lead">Usá el email y la contraseña de tu cuenta.</p>
        </div>
        <LoginForm onSuccess={signIn} />
      </div>
    </section>
  )
}
