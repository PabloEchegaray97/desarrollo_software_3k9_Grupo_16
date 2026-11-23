import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'

const navigation = [
  { to: '/', label: 'Inicio' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/pacientes', label: 'Pacientes' },
  { to: '/prestaciones', label: 'Prestaciones' },
  { to: '/disponibilidad', label: 'Disponibilidad' },
] as const

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="app-brand" to="/" aria-label="Ir al inicio">
          <span className="app-brand__mark" aria-hidden="true">+</span>
          Agenda odontológica
        </NavLink>
        <nav className="app-nav" aria-label="Navegación principal">
          {navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
