import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, page } from '../features/catalog/test-utils'
import { AppRoutes } from './routes'

function CurrentPath() {
  const location = useLocation()
  return <output aria-label="Ruta actual">{location.pathname}</output>
}

function mockDashboardAndBookingApis() {
  mockApi([
    ['GET /agenda', () => ({
      status: 200,
      body: {
        zonaHoraria: 'America/Argentina/Buenos_Aires',
        desde: '2027-03-10',
        hasta: '2027-03-10',
        generadoEn: '2027-03-10T12:30:00.000Z',
        turnos: [],
        dias: [],
      },
    })],
    ['GET /prestaciones', () => ({ status: 200, body: page([{ id: 'procedure-demo', nombre: 'Consulta ficticia', duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: null, activo: true, createdAt: '', updatedAt: '' }]) })],
    ['GET /sillones', () => ({ status: 200, body: page([{ id: 'chair-demo', nombre: 'Sillón ficticio', activo: true, createdAt: '', updatedAt: '' }]) })],
    ['GET /disponibilidad/configuracion', () => ({ status: 200, body: { intervaloGlobalMinutos: 10, zonaHoraria: 'America/Argentina/Buenos_Aires' } })],
    ['GET /pacientes', () => ({ status: 200, body: page([]) })],
  ])
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AppRoutes', () => {
  it('composes feature routes outside main.tsx', () => {
    render(<MemoryRouter initialEntries={['/pacientes']}><AppRoutes /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Pacientes' })).toBeInTheDocument()
  })

  it('uses the practice dashboard at the root route', async () => {
    mockApi([['GET /agenda', () => ({
      status: 200,
      body: {
        zonaHoraria: 'America/Argentina/Buenos_Aires',
        desde: '2027-03-10',
        hasta: '2027-03-10',
        generadoEn: '2027-03-10T12:30:00.000Z',
        turnos: [],
        dias: [],
      },
    })]])
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('opens the new-appointment route as a modal and returns focus to its dashboard action', async () => {
    mockDashboardAndBookingApis()
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
        <CurrentPath />
      </MemoryRouter>,
    )
    const user = userEvent.setup()
    const action = await screen.findByRole('link', { name: 'Crear turno' })

    await user.click(action)

    const dialog = await screen.findByRole('dialog', { name: 'Nuevo turno' })
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/turnos/nuevo')
    expect(within(dialog).getByRole('button', { name: 'Cerrar alta de turno' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar alta de turno' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/')
    expect(action).toHaveFocus()
  })

  it('closes the route modal with Escape and restores the originating route and focus', async () => {
    mockDashboardAndBookingApis()
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
        <CurrentPath />
      </MemoryRouter>,
    )
    const user = userEvent.setup()
    const action = await screen.findByRole('link', { name: 'Crear turno' })
    await user.click(action)
    expect(await screen.findByRole('dialog', { name: 'Nuevo turno' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/')
    expect(action).toHaveFocus()
  })

  it('shows a direct new-appointment URL over a stable dashboard background', async () => {
    mockDashboardAndBookingApis()
    render(
      <MemoryRouter initialEntries={['/turnos/nuevo']}>
        <AppRoutes />
        <CurrentPath />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo turno' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/turnos/nuevo')
    expect(document.querySelector('.practice-dashboard')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar alta de turno' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/')
  })
})
