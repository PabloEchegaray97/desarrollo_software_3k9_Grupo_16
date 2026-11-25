import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  CalendarBlank,
  CalendarX,
  Clock,
  House,
  List,
  Moon,
  Plus,
  SidebarSimple,
  SignOut,
  Stethoscope,
  Sun,
  Tooth,
  Users,
  X,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { AppModal } from '../../shared/components/AppModal'
import { useSession } from '../../features/auth/session'
import { useTheme } from '../theme/ThemeProvider'

const navigationItems: { to: string; label: string; Icon: PhosphorIcon; end?: boolean }[] = [
  { to: '/', label: 'Inicio', Icon: House, end: true },
  { to: '/agenda', label: 'Agenda', Icon: CalendarBlank },
  { to: '/pacientes', label: 'Pacientes', Icon: Users },
  { to: '/prestaciones', label: 'Servicios', Icon: Stethoscope },
  { to: '/disponibilidad', label: 'Disponibilidad', Icon: Clock },
  { to: '/bloqueos', label: 'Bloqueos', Icon: CalendarX },
]

const themeOptions = [
  { preference: 'light', label: 'Claro', Icon: Sun },
  { preference: 'dark', label: 'Oscuro', Icon: Moon },
] as const

interface ShellNavigationProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

function ShellBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <NavLink className="shell-brand" to="/" aria-label="Ir al inicio" title="OdoSoft">
      <Tooth className="shell-brand__tooth" size={30} weight="fill" aria-hidden="true" />
      {!collapsed ? (
        <span className="shell-brand__wordmark" aria-hidden="true">
          <span className="shell-brand__wordmark-main">Odo</span>
          <span className="shell-brand__wordmark-accent">Soft</span>
        </span>
      ) : null}
    </NavLink>
  )
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

function SidebarThemePicker({ collapsed }: { collapsed: boolean }) {
  const { resolvedTheme, setPreference } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionsId = useId()
  const ActiveThemeIcon = resolvedTheme === 'dark' ? Moon : Sun

  useEffect(() => {
    if (!expanded) return

    function closeOnOutsideClick(event: MouseEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setExpanded(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setExpanded(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [expanded])

  function chooseTheme(theme: 'light' | 'dark') {
    setPreference(theme)
    setExpanded(false)
    triggerRef.current?.focus()
  }

  return (
    <div
      ref={containerRef}
      className="shell-theme-picker"
      data-expanded={expanded}
      data-collapsed={collapsed}
    >
      <button
        ref={triggerRef}
        className="shell-control-button shell-theme-picker__trigger"
        type="button"
        aria-label={`Elegir tema, actual: ${resolvedTheme === 'dark' ? 'oscuro' : 'claro'}`}
        aria-expanded={expanded}
        aria-controls={optionsId}
        title="Elegir tema"
        onClick={() => setExpanded((current) => !current)}
      >
        <ActiveThemeIcon size={22} aria-hidden="true" />
      </button>
      {expanded ? (
        <div id={optionsId} className="shell-theme-picker__options" role="group" aria-label="Elegir tema">
          {themeOptions.map(({ preference: option, label, Icon }) => (
            <button
              key={option}
              className="shell-control-button shell-theme-picker__option"
              type="button"
              aria-label={label}
              aria-pressed={resolvedTheme === option}
              title={label}
              onClick={() => chooseTheme(option)}
            >
              <Icon size={22} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SidebarFooter({
  collapsed,
  signingOut,
  onSignOut,
  onToggleCollapsed,
  showCollapse = true,
}: {
  collapsed: boolean
  signingOut: boolean
  onSignOut: () => void
  onToggleCollapsed: () => void
  showCollapse?: boolean
}) {
  return (
    <div className="shell-sidebar__footer" data-collapsed={collapsed}>
      <button
        className="shell-control-button shell-logout"
        type="button"
        aria-label={signingOut ? 'Cerrando sesión' : 'Cerrar sesión'}
        title={signingOut ? 'Cerrando sesión' : 'Cerrar sesión'}
        onClick={onSignOut}
        disabled={signingOut}
      >
        <SignOut size={22} aria-hidden="true" />
      </button>

      <span className="shell-control-divider" aria-hidden="true" />
      <SidebarThemePicker collapsed={collapsed} />
      {showCollapse ? (
        <>
          <span className="shell-control-divider" aria-hidden="true" />
          <button
            className="shell-control-button shell-collapse"
            type="button"
            data-collapsed={collapsed}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
            onClick={onToggleCollapsed}
          >
            <SidebarSimple size={23} aria-hidden="true" />
          </button>
        </>
      ) : null}
    </div>
  )
}

export function ShellNavigation({ collapsed, onToggleCollapsed }: ShellNavigationProps) {
  const panelId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { signOut } = useSession()
  const close = () => setOpen(false)

  async function handleSignOut() {
    setSigningOut(true)
    setOpen(false)
    await signOut()
  }

  return (
    <>
      <header className="shell-mobilebar">
        <ShellBrand />
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
          <ShellBrand collapsed={collapsed} />
        </div>

        <Link
          to="/agenda/nuevo"
          className="shell-new-appointment"
          aria-label="Nuevo turno"
          title="Nuevo turno"
        >
          <Plus size={20} weight="bold" aria-hidden="true" />
          {!collapsed ? <span>Nuevo turno</span> : null}
        </Link>

        <NavigationLinks collapsed={collapsed} onNavigate={close} />
        <SidebarFooter
          collapsed={collapsed}
          signingOut={signingOut}
          onSignOut={() => void handleSignOut()}
          onToggleCollapsed={onToggleCollapsed}
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
            signingOut={signingOut}
            onSignOut={() => void handleSignOut()}
            onToggleCollapsed={onToggleCollapsed}
            showCollapse={false}
          />
        }
      >
        <Link
          to="/agenda/nuevo"
          className="shell-new-appointment shell-new-appointment--drawer"
          onClick={close}
          aria-label="Nuevo turno"
        >
          <Plus size={20} weight="bold" aria-hidden="true" />
          <span>Nuevo turno</span>
        </Link>
        <NavigationLinks collapsed={false} onNavigate={close} />
      </AppModal>
    </>
  )
}
