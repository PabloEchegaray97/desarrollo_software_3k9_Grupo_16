import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from '../../features/auth'
import { authenticated, callsTo, FICTIONAL_USER, mockApi, serverError, unauthorized, type FakeResponse } from '../../features/auth/test-utils'
import { AppShell } from './AppShell'

function renderShell(path = '/pacientes') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <Routes>
          <Route path="/acceso" element={<AuthPage />} />
          <Route path="/agenda" element={<h1>Agenda</h1>} />
          <Route path="/pacientes" element={<h1>Pacientes</h1>} />
          <Route path="/prestaciones" element={<h1>Prestaciones</h1>} />
        </Routes>
      </AppShell>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AppShell', () => {
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
    for (const name of ['Agenda', 'Pacientes', 'Prestaciones y sillones', 'Disponibilidad']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(nav).getByText('Configuración')).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Prestaciones y sillones' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(FICTIONAL_USER.email)).toBeInTheDocument()
  })

  it('toggles the mobile menu and closes it with Escape or after choosing a link', async () => {
    mockApi({ '/auth/sesion': () => authenticated })
    renderShell()
    const user = userEvent.setup()
    const toggle = await screen.findByRole('button', { name: 'Menú' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Menú' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Menú' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Menú' }))
    await user.click(screen.getByRole('link', { name: 'Agenda' }))
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menú' })).toHaveAttribute('aria-expanded', 'false')
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
