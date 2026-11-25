import { useId, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CalendarBlank,
  CaretDoubleLeft,
  CaretDoubleRight,
  Clock,
  Desktop,
  House,
  List,
  Moon,
  SignOut,
  Stethoscope,
  Sun,
  UserCircle,
  Users,
  X,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { AppModal } from '../../shared/components/AppModal'
import { useSession } from '../../features/auth/session'
import { useTheme } from '../theme/ThemeProvider'
import type { ThemePreference } from '../theme/theme'

const navigationItems: { to: string; label: string; Icon: PhosphorIcon; end?: boolean }[] = [
  { to: '/', label: 'Inicio', Icon: House, end: true },
  { to: '/agenda', label: 'Agenda', Icon: CalendarBlank },
  { to: '/pacientes', label: 'Pacientes', Icon: Users },
  { to: '/prestaciones', label: 'Prestaciones y sillones', Icon: Stethoscope },
  { to: '/disponibilidad', label: 'Disponibilidad', Icon: Clock },
]

const themeOptions: { preference: ThemePreference; label: string; Icon: PhosphorIcon }[] = [
  { preference: 'light', label: 'Claro', Icon: Sun },
  { preference: 'dark', label: 'Oscuro', Icon: Moon },
  { preference: 'system', label: 'Sistema', Icon: Desktop },
]

interface ShellNavigationProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

function NavigationLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  return (
    <nav className="shell-nav" aria-label="Navegación principal">
      <ul className="shell-nav__list">
        {navigationItems.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              className="shell-link"
              to={to}
              end={end}
              onClick={onNavigate}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              data-tooltip={label}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    weight={isActive ? 'fill' : 'regular'}
                    data-phosphor-weight={isActive ? 'fill' : 'regular'}
                    aria-hidden="true"
                  />
                  <span className="shell-link__label">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function SidebarFooter({
  collapsed,
  email,
  signingOut,
  onSignOut,
}: {
  collapsed: boolean
  email: string
  signingOut: boolean
  onSignOut: () => void
}) {
  const { preference, setPreference } = useTheme()

  return (
    <div className="shell-sidebar__footer">
      <div className="shell-theme" role="group" aria-label="Tema">
        <span className={`shell-theme__label${collapsed ? ' shell-visually-hidden' : ''}`}>Tema</span>
        <div className="shell-theme__options">
          {themeOptions.map(({ preference: option, label, Icon }) => (
            <button
              key={option}
              className="shell-theme__button"
              type="button"
              aria-label={`Tema ${label}`}
              aria-pressed={preference === option}
              title={`Tema ${label}`}
              onClick={() => setPreference(option)}
            >
              <Icon
                size={20}
                weight={preference === option ? 'fill' : 'regular'}
                data-phosphor-weight={preference === option ? 'fill' : 'regular'}
                aria-hidden="true"
              />
              <span className={collapsed ? 'shell-visually-hidden' : undefined}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="shell-account">
        <UserCircle size={22} aria-hidden="true" />
        <span className={collapsed ? 'shell-visually-hidden' : 'shell-account__email'} title={email}>
          {email}
        </span>
      </div>

      <button
        className="shell-logout"
        type="button"
        aria-label={signingOut ? 'Cerrando sesión' : 'Cerrar sesión'}
        title="Cerrar sesión"
        onClick={onSignOut}
        disabled={signingOut}
      >
        <SignOut size={20} aria-hidden="true" />
        <span className={collapsed ? 'shell-visually-hidden' : undefined}>
          {signingOut ? 'Cerrando…' : 'Cerrar sesión'}
        </span>
      </button>
    </div>
  )
}

export function ShellNavigation({ collapsed, onToggleCollapsed }: ShellNavigationProps) {
  const panelId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { state, signOut } = useSession()
  const email = state.status === 'authenticated' ? state.user.email : ''

  const close = () => setOpen(false)

  async function handleSignOut() {
    setSigningOut(true)
    setOpen(false)
    await signOut()
  }

  return (
    <>
      <header className="shell-mobilebar">
        <NavLink className="shell-brand" to="/" aria-label="Ir al inicio">
          <span className="shell-brand__mark" aria-hidden="true">O</span>
          <span>OdoSoft</span>
        </NavLink>
        <button
          ref={toggleRef}
          className="shell-mobilebar__toggle"
          type="button"
          aria-label={open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} aria-hidden="true" /> : <List size={22} aria-hidden="true" />}
        </button>
      </header>

      <aside className="app-sidebar" data-collapsed={collapsed} aria-label="Barra lateral">
        <div className="app-sidebar__brand-row">
          <NavLink className="shell-brand" to="/" aria-label="Ir al inicio" title="OdoSoft">
            <span className="shell-brand__mark" aria-hidden="true">O</span>
            <span className={collapsed ? 'shell-visually-hidden' : undefined}>OdoSoft</span>
          </NavLink>
          <button
            className="shell-collapse"
            type="button"
            aria-label={collapsed ? 'Expandir navegación' : 'Contraer navegación'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir navegación' : 'Contraer navegación'}
            onClick={onToggleCollapsed}
          >
            {collapsed
              ? <CaretDoubleRight size={20} aria-hidden="true" />
              : <CaretDoubleLeft size={20} aria-hidden="true" />}
          </button>
        </div>

        <NavigationLinks collapsed={collapsed} onNavigate={close} />
        <SidebarFooter
          collapsed={collapsed}
          email={email}
          signingOut={signingOut}
          onSignOut={() => void handleSignOut()}
        />
      </aside>

      <AppModal
        id={panelId}
        className="shell-drawer-panel"
        closeLabel="Cerrar navegación"
        open={open}
        title="Menú de navegación"
        onClose={close}
        footer={
          <SidebarFooter
            collapsed={false}
            email={email}
            signingOut={signingOut}
            onSignOut={() => void handleSignOut()}
          />
        }
      >
        <NavigationLinks collapsed={false} onNavigate={close} />
      </AppModal>
    </>
  )
}
