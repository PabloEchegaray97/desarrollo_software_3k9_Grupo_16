import { useEffect, useId, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useSession } from '../../features/auth/session'

const primaryLinks = [
  { to: '/agenda', label: 'Agenda' },
  { to: '/pacientes', label: 'Pacientes' },
] as const

const settingsLinks = [
  { to: '/prestaciones', label: 'Prestaciones y sillones' },
  { to: '/disponibilidad', label: 'Disponibilidad' },
] as const

export function ShellNavigation() {
  const panelId = useId()
  const settingsId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { state, signOut } = useSession()
  const email = state.status === 'authenticated' ? state.user.email : ''

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const close = () => setOpen(false)

  async function handleSignOut() {
    setSigningOut(true)
    setOpen(false)
    await signOut()
  }

  return (
    <header className="shell-header">
      <div className="shell-bar">
        <NavLink className="shell-brand" to="/" aria-label="Ir al inicio" onClick={close}>
          <span className="shell-brand__mark" aria-hidden="true">+</span>
          Agenda odontológica
        </NavLink>
        <button
          ref={toggleRef}
          className="shell-toggle"
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Cerrar menú' : 'Menú'}
        </button>
      </div>

      <div className="shell-panel" id={panelId} data-open={open}>
        <nav className="shell-nav" aria-label="Navegación principal">
          <ul className="shell-nav__list">
            {primaryLinks.map((link) => (
              <li key={link.to}><NavLink className="shell-link" to={link.to} onClick={close}>{link.label}</NavLink></li>
            ))}
            <li className="shell-nav__group">
              <span className="shell-nav__group-label" id={settingsId}>Configuración</span>
              <ul className="shell-nav__list" aria-labelledby={settingsId}>
                {settingsLinks.map((link) => (
                  <li key={link.to}><NavLink className="shell-link" to={link.to} onClick={close}>{link.label}</NavLink></li>
                ))}
              </ul>
            </li>
          </ul>
        </nav>

        <div className="shell-account">
          <span className="shell-account__email" title={email}>{email}</span>
          <button className="shell-logout" type="button" onClick={() => void handleSignOut()} disabled={signingOut}>
            {signingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      </div>
    </header>
  )
}
