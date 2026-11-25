import { cleanup, render, screen, within } from '@testing-library/react'
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
  it('counts the backend response by state and requests only today in the clinic timezone', async () => {
    const turnos = APPOINTMENT_STATUSES.map((estado, index) => turno(estado, index))
    const { requests } = mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse(turnos) })]])
    renderDashboard()

    expect(await screen.findByRole('article', { name: 'Turnos de hoy: 5' })).toBeInTheDocument()
    for (const label of ['Programados', 'Confirmados', 'Atendidos', 'Ausentes', 'Cancelados']) {
      expect(screen.getByRole('article', { name: `${label}: 1` })).toBeInTheDocument()
    }

    const params = requestRange(requests[0])
    expect(params.get('desde')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(params.get('hasta')).toBe(params.get('desde'))
    expect(params.has('sillonId')).toBe(false)
  })

  it('shows zero metrics and keeps main access links for an empty day', async () => {
    mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse([]) })]])
    renderDashboard()

    const dashboard = screen.getByRole('heading', { name: 'Inicio' }).closest('.practice-dashboard')
    expect(dashboard).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Métricas de hoy' })).toHaveClass('dashboard-metrics')
    expect(await screen.findByRole('article', { name: 'Turnos de hoy: 0' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No hay turnos para hoy.')
    for (const label of ['Programados', 'Confirmados', 'Atendidos', 'Ausentes', 'Cancelados']) {
      expect(screen.getByRole('article', { name: `${label}: 0` })).toBeInTheDocument()
    }
    expect(within(screen.getByRole('navigation', { name: 'Accesos principales' })).getByRole('link', { name: 'Agenda' }))
      .toHaveAttribute('href', '/agenda')
    expect(screen.getByRole('link', { name: '+ Nuevo turno' })).toHaveAttribute('href', '/turnos/nuevo')
  })

  it('preserves dashboard grouping and status semantics', async () => {
    mockApi([['GET /agenda', () => ({ status: 200, body: agendaResponse([turno('CONFIRMADO', 1)]) })]])
    renderDashboard()

    const metrics = screen.getByRole('region', { name: 'Métricas de hoy' })
    expect(await within(metrics).findByRole('article', { name: 'Confirmados: 1' })).toHaveAttribute('data-status', 'CONFIRMADO')
    expect(screen.getByRole('navigation', { name: 'Accesos principales' })).toHaveClass('dashboard-shortcuts')
    expect(screen.getByRole('link', { name: '+ Nuevo turno' })).toHaveClass('dashboard-primary-action')
  })

  it('keeps access links visible on error and retries the request', async () => {
    let attempts = 0
    mockApi([['GET /agenda', () => (
      ++attempts === 1
        ? apiError(500, 'INTERNAL', 'Fallo ficticio')
        : { status: 200, body: agendaResponse([turno('PROGRAMADO', 1)]) }
    )]])
    renderDashboard()

    expect(await screen.findByText('No se pudo cargar el resumen de hoy')).toBeInTheDocument()
    const shortcuts = screen.getByRole('navigation', { name: 'Accesos principales' })
    expect(within(shortcuts).getByRole('link', { name: 'Disponibilidad' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('article', { name: 'Turnos de hoy: 1' })).toBeInTheDocument()
  })
})
