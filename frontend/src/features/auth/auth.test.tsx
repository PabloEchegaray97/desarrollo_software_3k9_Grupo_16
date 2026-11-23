import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, type InitialEntry } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthPage, safeDestination } from '.'
import { SessionProvider } from './session'
import { authenticated, callsTo, mockApi, unauthorized, type FakeResponse } from './test-utils'

function renderAuth(entry: InitialEntry = '/acceso') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <SessionProvider>
        <Routes>
          <Route path="/acceso" element={<AuthPage />} />
          <Route path="/agenda" element={<h1>Agenda destino</h1>} />
          <Route path="/pacientes" element={<h1>Pacientes destino</h1>} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  )
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup()
  if (email) await user.type(screen.getByLabelText('Email'), email)
  if (password) await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))
  return user
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AuthPage', () => {
  it('validates required fields without calling the API', async () => {
    const fetchMock = mockApi({ '/auth/sesion': () => unauthorized, '/auth/login': () => authenticated })
    renderAuth()
    await fillAndSubmit('', '')
    expect(screen.getByText('Ingresá tu email.')).toBeInTheDocument()
    expect(screen.getByText('Ingresá tu contraseña.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(callsTo(fetchMock, '/auth/login')).toHaveLength(0)
  })

  it('rejects a malformed email', async () => {
    mockApi({ '/auth/sesion': () => unauthorized })
    renderAuth()
    await fillAndSubmit('no-es-email', 'contrasena-ficticia-123')
    expect(screen.getByText('Ingresá un email válido.')).toBeInTheDocument()
  })

  it('shows a generic message, keeps the email and clears the password on 401', async () => {
    mockApi({ '/auth/sesion': () => unauthorized, '/auth/login': () => unauthorized })
    renderAuth()
    await fillAndSubmit('odontologo.ficticio@example.test', 'otra-contrasena-ficticia')
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos')
    expect(screen.getByLabelText('Email')).toHaveValue('odontologo.ficticio@example.test')
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
  })

  it('returns to the originally requested route after signing in', async () => {
    const fetchMock = mockApi({ '/auth/sesion': () => unauthorized, '/auth/login': () => authenticated })
    renderAuth({ pathname: '/acceso', state: { from: '/pacientes' } })
    await fillAndSubmit('  odontologo.ficticio@example.test ', 'contrasena-ficticia-123')
    expect(await screen.findByRole('heading', { name: 'Pacientes destino' })).toBeInTheDocument()
    const [, init] = callsTo(fetchMock, '/auth/login')[0]
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'odontologo.ficticio@example.test', contrasena: 'contrasena-ficticia-123' })
  })

  it('disables the button while the request is pending and avoids duplicates', async () => {
    let resolveLogin: (value: FakeResponse) => void = () => {}
    const fetchMock = mockApi({
      '/auth/sesion': () => unauthorized,
      '/auth/login': () => new Promise<FakeResponse>((resolve) => { resolveLogin = resolve }),
    })
    renderAuth()
    const user = await fillAndSubmit('odontologo.ficticio@example.test', 'contrasena-ficticia-123')
    const pending = screen.getByRole('button', { name: 'Ingresando…' })
    expect(pending).toBeDisabled()
    await user.click(pending)
    expect(callsTo(fetchMock, '/auth/login')).toHaveLength(1)
    resolveLogin(authenticated)
    expect(await screen.findByRole('heading', { name: 'Agenda destino' })).toBeInTheDocument()
  })

  it('redirects to the agenda when a session already exists', async () => {
    mockApi({ '/auth/sesion': () => authenticated })
    renderAuth()
    expect(await screen.findByRole('heading', { name: 'Agenda destino' })).toBeInTheDocument()
  })

  it('never stores the password in web storage', async () => {
    mockApi({ '/auth/sesion': () => unauthorized, '/auth/login': () => authenticated })
    renderAuth()
    await fillAndSubmit('odontologo.ficticio@example.test', 'contrasena-ficticia-123')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Agenda destino' })).toBeInTheDocument())
    expect(JSON.stringify({ ...localStorage })).not.toContain('contrasena-ficticia-123')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('contrasena-ficticia-123')
  })
})

describe('safeDestination', () => {
  it.each([
    [{ from: '/pacientes?q=1' }, '/pacientes?q=1'],
    [{ from: '//sitio-externo.test' }, '/agenda'],
    [{ from: 'https://sitio-externo.test' }, '/agenda'],
    [{ from: '/acceso' }, '/agenda'],
    [null, '/agenda'],
    [{ from: 3 }, '/agenda'],
  ])('maps %p to %p', (state, expected) => {
    expect(safeDestination(state)).toBe(expected)
  })
})
