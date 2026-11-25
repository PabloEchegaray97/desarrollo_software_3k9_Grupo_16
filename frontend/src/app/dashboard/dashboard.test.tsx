import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, mockApi, type RecordedRequest } from '../../features/catalog/test-utils'
import { APPOINTMENT_STATUSES, type AgendaResponse, type AgendaTurno } from '../../features/agenda/types'
import { PracticeDashboard } from './index'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function turno(estado: AgendaTurno['estado'], index: number): AgendaTurno {
  return {
    id: `appointment-${index}`,
    estado,
    inicio: '2027-03-10T12:00:00.000Z',
    finAtencion: '2027-03-10T12:30:00.000Z',
    finBloqueo: '2027-03-10T12:40:00.000Z',
    duracionMinutos: 30,
    intervaloPosteriorMinutos: 10,
    bloqueaHorario: true,
    fueraDisponibilidad: false,
    motivoExcepcion: null,
    paciente: { id: `patient-${index}`, nombre: 'Paciente Ficticio' },
    prestacion: { id: 'procedure-demo', nombre: 'Consulta ficticia' },
    sillon: { id: 'chair-demo', nombre: 'Sillón ficticio' },
  }
}

function agendaResponse(turnos: AgendaTurno[]): AgendaResponse {
  return {
    zonaHoraria: 'America/Argentina/Buenos_Aires',
    desde: '2027-03-10',
    hasta: '2027-03-10',
    generadoEn: '2027-03-10T12:30:00.000Z',
    turnos,
    dias: [],
  }
}

function renderDashboard() {
  return render(<MemoryRouter initialEntries={['/']}><PracticeDashboard /></MemoryRouter>)
}

function requestRange(request: RecordedRequest): URLSearchParams {
  return new URLSearchParams(request.path.slice(request.path.indexOf('?') + 1))
}

describe('PracticeDashboard', () => {
  it('summarises the daily agenda and requests only today in the clinic timezone', async () => {
    const turnos = APPOINTMENT_STATUSES.map((estado, index) => turno(estado, index))
    const { requests } = mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse(turnos) })]])
    renderDashboard()

    expect(await screen.findByRole('article', { name: 'Turnos hoy: 5' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Pendientes: 1' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Confirmados: 1' })).toBeInTheDocument()

    const params = requestRange(requests[0])
    expect(params.get('desde')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(params.get('hasta')).toBe(params.get('desde'))
    expect(params.has('sillonId')).toBe(false)
  })

  it('shows the premium empty agenda and keeps the primary routes', async () => {
    mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse([]) })]])
    renderDashboard()

    const dashboard = screen.getByRole('heading', { name: 'Inicio' }).closest('.practice-dashboard')
    expect(dashboard).toBeInTheDocument()
    const summary = await screen.findByRole('region', { name: 'Resumen de hoy' })
    expect(summary).toHaveClass('dashboard-summary')
    expect(within(summary).getByRole('article', { name: 'Turnos hoy: 0' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No hay turnos agendados para hoy.')
    expect(screen.getByRole('link', { name: 'Hoy (0)' })).toHaveAttribute('href', '/agenda')
    expect(screen.getByRole('link', { name: 'Crear turno' })).toHaveAttribute('href', '/turnos/nuevo')
  })

  it('preserves summary grouping and appointment status semantics', async () => {
    mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse([turno('CONFIRMADO', 1)]) })]])
    renderDashboard()

    const summary = await screen.findByRole('region', { name: 'Resumen de hoy' })
    expect(within(summary).getByRole('article', { name: 'Confirmados: 1' })).toHaveClass('dashboard-summary__confirmed')
    expect(screen.getByText('Confirmado')).toHaveAttribute('data-status', 'CONFIRMADO')
    expect(screen.queryByRole('link', { name: 'Nuevo turno' })).not.toBeInTheDocument()
  })

  it('opens the appointment context menu from a secondary click', async () => {
    mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse([turno('PROGRAMADO', 1)]) })]])
    renderDashboard()

    const appointment = await screen.findByRole('button', { name: /Ver turno de Paciente Ficticio/ })
    const row = appointment.closest('.dashboard-appointment')
    expect(row).not.toBeNull()
    fireEvent.contextMenu(row as HTMLElement, { clientX: 320, clientY: 240 })

    const menu = screen.getByRole('menu', { name: /Acciones del turno de Paciente Ficticio/ })
    expect(within(menu).getByRole('menuitem', { name: 'Ver detalle' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Reprogramar' })).toBeEnabled()
    expect(within(menu).getByRole('menuitem', { name: 'Cancelar' })).toBeEnabled()
  })

  it('retries the request after an error', async () => {
    let attempts = 0
    mockApi([['GET /agenda', () => (
      ++attempts === 1
        ? apiError(500, 'INTERNAL', 'Fallo ficticio')
        : { status: 200, body: agendaResponse([turno('PROGRAMADO', 1)]) }
    )]])
    renderDashboard()

    expect(await screen.findByText('No se pudo cargar el resumen de hoy')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('article', { name: 'Turnos hoy: 1' })).toBeInTheDocument()
  })
})
