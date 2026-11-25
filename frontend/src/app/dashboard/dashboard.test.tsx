import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, mockApi, type RecordedRequest } from '../../features/catalog/test-utils'
import { APPOINTMENT_STATUSES, type AgendaResponse, type AgendaTurno } from '../../features/agenda/types'
import { notifyAppointmentsChanged } from '../../features/appointments/events'
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
    expect(screen.getByRole('status')).toHaveTextContent('La agenda está libre este día.')
    expect(screen.getByRole('combobox', { name: 'Período de turnos' })).toHaveValue('today')
    expect(screen.getByRole('link', { name: 'Crear turno' })).toHaveAttribute('href', '/turnos/nuevo')
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Turnos por página' })).toHaveValue('10')
    expect(screen.getByText('Página 1 de 1 · 0 turnos')).toBeInTheDocument()
  })

  it('alterna entre hoy y todos los próximos turnos sin navegar a Agenda', async () => {
    const first = turno('PROGRAMADO', 1)
    first.inicio = '2027-03-11T12:00:00.000Z'
    first.finAtencion = '2027-03-11T12:30:00.000Z'
    first.finBloqueo = '2027-03-11T12:40:00.000Z'
    const second = turno('CONFIRMADO', 2)
    second.inicio = '2027-03-12T15:00:00.000Z'
    second.finAtencion = '2027-03-12T15:30:00.000Z'
    second.finBloqueo = '2027-03-12T15:40:00.000Z'

    const { requests } = mockApi([
      ['GET /agenda/proximos', () => ({ status: 200, body: { ...agendaResponse([first, second]), dias: undefined } })],
      ['GET /agenda', () => ({ status: 200, body: agendaResponse([]) })],
    ])
    renderDashboard()

    expect(await screen.findByRole('status')).toHaveTextContent('La agenda está libre este día.')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Período de turnos' }), 'upcoming')

    expect(screen.getByRole('heading', { name: 'Próximos turnos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /jueves, 11 de marzo de 2027/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /viernes, 12 de marzo de 2027/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Ver turno de Paciente Ficticio/ })).toHaveLength(2)
    expect(requests.some((request) => request.path.startsWith('/agenda/proximos?desde='))).toBe(true)
  })

  it('changes the number of visible appointments and resets pagination', async () => {
    const turnos = Array.from({ length: 6 }, (_, index) => turno('PROGRAMADO', index))
    mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse(turnos) })]])
    renderDashboard()

    await screen.findByRole('article', { name: 'Turnos hoy: 6' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Turnos por página' }), '5')

    expect(screen.getByText('Página 1 de 2 · 6 turnos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: /Ver turno de Paciente Ficticio/ })).toHaveLength(5)
  })

  it('opens the page that contains the next operative appointment', async () => {
    const turnos = Array.from({ length: 15 }, (_, index) => turno(index < 10 ? 'CANCELADO' : 'PROGRAMADO', index))
    mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse(turnos) })]])
    renderDashboard()

    expect(await screen.findByText('Página 2 de 2 · 15 turnos')).toBeInTheDocument()
    const visibleRows = screen.getAllByRole('button', { name: /Ver turno de Paciente Ficticio/ })
    expect(visibleRows).toHaveLength(5)
    expect(visibleRows[0]?.closest('.dashboard-appointment')).toHaveAttribute('data-highlighted', 'true')
  })

  it('preserves summary grouping and appointment status semantics', async () => {
    mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse([turno('CONFIRMADO', 1)]) })]])
    renderDashboard()

    const summary = await screen.findByRole('region', { name: 'Resumen de hoy' })
    expect(within(summary).getByRole('article', { name: 'Confirmados: 1' })).toHaveClass('dashboard-summary__confirmed')
    expect(screen.getByText('Confirmado').closest('[data-status]')).toHaveAttribute('data-status', 'CONFIRMADO')
    expect(screen.queryByRole('link', { name: 'Nuevo turno' })).not.toBeInTheDocument()
  })

  it('opens the appointment detail in a lateral panel on desktop', async () => {
    mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse([turno('PROGRAMADO', 1)]) })]])
    renderDashboard()

    const appointment = await screen.findByRole('button', { name: /Ver turno de Paciente Ficticio/ })
    await userEvent.click(appointment)

    const detail = screen.getByRole('complementary', { name: 'Detalle del turno' })
    expect(within(detail).getByText('Consulta ficticia')).toBeInTheDocument()
    const detailLink = within(detail).getByRole('link', { name: 'Ver detalle' })
    expect(detailLink).toHaveAttribute('href', '/turnos/appointment-1')
    const actions = detailLink.closest('footer')
    expect(actions).toHaveClass('agenda-detail__footer')
    expect(Array.from(actions?.querySelectorAll('a, button') ?? []).map((action) => action.textContent?.trim()))
      .toEqual(['Cancelar', 'Reprogramar', 'Ver detalle'])
    expect(within(detail).getByRole('link', { name: 'Reprogramar' })).toHaveAttribute('href', '/turnos/appointment-1')
    expect(within(detail).getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/turnos/appointment-1')
    expect(appointment).toHaveAttribute('aria-pressed', 'true')
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

  it('opens appointment actions as a bottom sheet on mobile', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 48rem)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse([turno('PROGRAMADO', 1)]) })]])
    renderDashboard()

    const appointment = await screen.findByRole('button', { name: /Ver turno de Paciente Ficticio/ })
    await userEvent.click(appointment)

    const sheet = screen.getByRole('dialog', { name: 'Acciones del turno' })
    expect(within(sheet).getByText('Paciente Ficticio')).toBeInTheDocument()
    expect(within(sheet).getByText('Horario')).toBeInTheDocument()
    expect(within(sheet).getByText('Turno')).toBeInTheDocument()
    expect(within(sheet).getByRole('menuitem', { name: 'Ver detalle' })).toBeInTheDocument()
    expect(within(sheet).getByRole('menuitem', { name: 'Reprogramar' })).toBeEnabled()
    expect(within(sheet).getByRole('menuitem', { name: 'Cancelar turno' })).toBeEnabled()

    await userEvent.click(within(sheet).getByRole('button', { name: 'Cerrar acciones del turno' }))
    expect(appointment).not.toHaveFocus()
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

  it('actualiza automáticamente las listas cuando se crea un turno', async () => {
    const { requests } = mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse([]) })]])
    renderDashboard()

    expect(await screen.findByRole('article', { name: 'Turnos hoy: 0' })).toBeInTheDocument()
    expect(requests).toHaveLength(2)

    notifyAppointmentsChanged()

    await waitFor(() => expect(requests).toHaveLength(4))
  })
})
