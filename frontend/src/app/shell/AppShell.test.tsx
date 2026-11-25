import { readFileSync } from 'node:fs'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from '../../features/auth'
import { authenticated, callsTo, FICTIONAL_USER, mockApi, serverError, unauthorized, type FakeResponse } from '../../features/auth/test-utils'
import { ThemeProvider } from '../theme/ThemeProvider'
import { AppShell } from './AppShell'

const appShellCss = readFileSync('src/app/shell/app-shell.css', 'utf8')

function renderShell(path = '/pacientes') {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppShell>
          <Routes>
            <Route path="/" element={<h1>Inicio</h1>} />
            <Route path="/acceso" element={<AuthPage />} />
            <Route path="/agenda" element={<h1>Agenda</h1>} />
            <Route path="/pacientes" element={<h1>Pacientes</h1>} />
            <Route path="/prestaciones" element={<h1>Prestaciones</h1>} />
          </Routes>
        </AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AppShell', () => {
  it('keeps the desktop sidebar flush and the content full-width with a one-rem inset', () => {
    expect(appShellCss).toMatch(/\.app-shell\s*\{[^}]*grid-template-columns: var\(--sidebar-expanded\) minmax\(0, 1fr\)/)
    expect(appShellCss).toMatch(/\.app-shell\[data-sidebar-collapsed='true'\]\s*\{[^}]*grid-template-columns: var\(--sidebar-collapsed\) minmax\(0, 1fr\)/)
    expect(appShellCss).toMatch(/\.app-main\s*\{[^}]*width: 100%;[^}]*margin: 0;[^}]*padding: var\(--space-4\)/)
    expect(appShellCss).toMatch(/\.app-sidebar\s*\{[^}]*top: 0;[^}]*height: 100dvh;[^}]*margin: 0;[^}]*border-radius: 0 var\(--radius-lg\) var\(--radius-lg\) 0/)
  })

  it('shows a loading state and no protected content while the session is checked', async () => {
    let resolveSession: (value: FakeResponse) => void = () => {}
    mockApi({ '/auth/sesion': () => new Promise<FakeResponse>((resolve) => { resolveSession = resolve }) })
    renderShell()
    expect(screen.getByText('Verificando sesión')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pacientes' })).not.toBeInTheDocument()
    resolveSession(authenticated)
    expect(await screen.findByRole('heading', { name: 'Pacientes' })).toBeInTheDocument()
  })

  it('redirects to the login screen without a session and comes back after signing in', async () => {
    mockApi({ '/auth/sesion': () => unauthorized, '/auth/login': () => authenticated })
    renderShell('/pacientes')
    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), FICTIONAL_USER.email)
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena-ficticia-123')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('heading', { name: 'Pacientes' })).toBeInTheDocument()
  })

  it('offers a retry when the session check fails technically', async () => {
    let attempt = 0
    mockApi({ '/auth/sesion': () => (attempt++ === 0 ? serverError : authenticated) })
    renderShell()
    expect(await screen.findByText('No pudimos verificar la sesión')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pacientes' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Pacientes' })).toBeInTheDocument()
  })

  it('renders the main navigation, the account and the active link', async () => {
    mockApi({ '/auth/sesion': () => authenticated })
    renderShell('/prestaciones')
    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' })
    for (const name of ['Inicio', 'Agenda', 'Pacientes', 'Servicios', 'Disponibilidad']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Servicios' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(FICTIONAL_USER.email)).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Servicios' }).querySelector('svg'))
      .toHaveAttribute('data-phosphor-weight', 'fill')
    expect(within(nav).getByRole('link', { name: 'Agenda' }).querySelector('svg'))
      .toHaveAttribute('data-phosphor-weight', 'regular')
  })

  it('collapses the sidebar and persists the visual preference', async () => {
    mockApi({ '/auth/sesion': () => authenticated })
    renderShell()
    const user = userEvent.setup()
    await screen.findByRole('navigation', { name: 'Navegación principal' })

    await user.click(screen.getByRole('button', { name: 'Contraer navegación' }))
    expect(document.querySelector('.app-shell')).toHaveAttribute('data-sidebar-collapsed', 'true')
    expect(localStorage.getItem('odosoft.sidebar-collapsed')).toBe('true')
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('title', 'Agenda')

    await user.click(screen.getByRole('button', { name: 'Expandir navegación' }))
    expect(document.querySelector('.app-shell')).toHaveAttribute('data-sidebar-collapsed', 'false')
    expect(localStorage.getItem('odosoft.sidebar-collapsed')).toBe('false')
  })

  it('changes the theme preference from the sidebar controls', async () => {
    mockApi({ '/auth/sesion': () => authenticated })
    renderShell()
    const user = userEvent.setup()
    await screen.findByRole('navigation', { name: 'Navegación principal' })

    await user.click(screen.getByRole('button', { name: 'Tema Oscuro' }))

    expect(screen.getByRole('button', { name: 'Tema Oscuro' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('odosoft.theme')).toBe('dark')
  })

  it('opens the mobile drawer, traps focus and closes with Escape, its button or a destination', async () => {
    mockApi({ '/auth/sesion': () => authenticated })
    renderShell()
    const user = userEvent.setup()
    const toggle = await screen.findByRole('button', { name: 'Abrir menú de navegación' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    const dialog = screen.getByRole('dialog', { name: 'Menú de navegación' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('aria-controls', dialog.id)
    expect(screen.getByRole('heading', { name: 'Menú de navegación' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menú de navegación' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Abrir menú de navegación' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar navegación' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menú de navegación' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }))
    const mobileNav = within(screen.getByRole('dialog')).getByRole('navigation', { name: 'Navegación principal' })
    await user.click(within(mobileNav).getByRole('link', { name: 'Agenda' }))
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menú de navegación' })).toHaveFocus()
  })

  it('signs out through the API and returns to the login screen', async () => {
    const fetchMock = mockApi({ '/auth/sesion': () => authenticated, '/auth/logout': () => ({ status: 204 }) })
    renderShell()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
    const [call] = callsTo(fetchMock, '/auth/logout')
    expect(call[1]).toMatchObject({ method: 'POST', credentials: 'include' })
  })
})
