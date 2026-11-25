import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, mockApi, page } from '../catalog/test-utils'
import { AGENDA_VIEW_STORAGE_KEY } from './AgendaToolbar'
import { AppointmentAgendaPage } from './index'
import type { AgendaResponse, AgendaTurno } from './types'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.removeItem(AGENDA_VIEW_STORAGE_KEY) })

const turno = (over: Partial<AgendaTurno> = {}): AgendaTurno => ({
  id: 't1', estado: 'PROGRAMADO', inicio: '2027-03-10T13:00:00.000Z', finAtencion: '2027-03-10T13:40:00.000Z',
  finBloqueo: '2027-03-10T13:50:00.000Z', duracionMinutos: 40, intervaloPosteriorMinutos: 10, bloqueaHorario: true,
  fueraDisponibilidad: false, motivoExcepcion: null,
  paciente: { id: 'p1', nombre: 'Paciente Ficticio' }, prestacion: { id: 'pr1', nombre: 'Limpieza' }, sillon: { id: 's1', nombre: 'Sillón 1' },
  ...over,
})
const response = (turnos: AgendaTurno[], over: Partial<AgendaResponse> = {}): AgendaResponse => ({
  zonaHoraria: 'America/Argentina/Buenos_Aires', desde: '2027-03-01', hasta: '2027-03-31', generadoEn: '2027-03-10T12:30:00.000Z', turnos,
  dias: [{ fecha: '2027-03-10', tramos: [{ horaInicio: '09:00', horaFin: '13:00' }], bloqueos: [] }], ...over,
})
const chairs = page([{ id: 's1', nombre: 'Sillón 1', activo: true, createdAt: '', updatedAt: '' }])
const agendaCss = readFileSync(resolve(process.cwd(), 'src/features/agenda/agenda.css'), 'utf8')

const renderAgenda = (path = '/agenda?fecha=2027-03-10') =>
  render(<MemoryRouter initialEntries={[path]}><AppointmentAgendaPage /></MemoryRouter>)

describe('AppointmentAgendaPage', () => {
  it('muestra la agenda mensual con estado, horario local y consulta acotada al mes', async () => {
    const { requests } = mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([turno()]) })]])
    renderAgenda()
    expect(await screen.findByText('Paciente Ficticio')).toBeTruthy()
    expect(screen.getByText('10:00–10:40')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Turnos del día' })).getByText('Programado')).toBeTruthy()
    expect(screen.getByText(/Actualizado a las 09:30/)).toBeTruthy()
    expect(screen.getByText(/Disponibilidad: 09:00–13:00/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Calendario' })).toHaveAttribute('aria-pressed', 'true')
    expect(requests.filter((request) => request.path.startsWith('/agenda')).map((request) => request.path))
      .toEqual(['/agenda?desde=2027-03-01&hasta=2027-03-31'])
  })

  it('persists the selected list by keyboard without changing the backend query', async () => {
    const { requests } = mockApi([
      ['GET /sillones', () => ({ status: 200, body: chairs })],
      ['GET /agenda', () => ({ status: 200, body: response([turno()]) })],
    ])
    renderAgenda()
    await screen.findByText('Paciente Ficticio')
    const listButton = screen.getByRole('button', { name: 'Lista' })
    listButton.focus()
    await userEvent.keyboard('{Enter}')

    expect(listButton).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem(AGENDA_VIEW_STORAGE_KEY)).toBe('list')
    expect(screen.getByRole('list', { name: 'Turnos del miércoles, 10 de marzo de 2027' })).toBeInTheDocument()
    expect(requests.filter((request) => request.path.startsWith('/agenda'))).toHaveLength(1)

    cleanup()
    renderAgenda()
    expect(await screen.findByRole('list', { name: 'Turnos del miércoles, 10 de marzo de 2027' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('filters the loaded month locally without requesting patient records', async () => {
    const otherTurno = turno({
      id: 't2',
      paciente: { id: 'p2', nombre: 'Paciente Secundario' },
      inicio: '2027-03-11T13:00:00.000Z',
      finAtencion: '2027-03-11T13:40:00.000Z',
      finBloqueo: '2027-03-11T13:50:00.000Z',
    })
    const { requests } = mockApi([
      ['GET /sillones', () => ({ status: 200, body: chairs })],
      ['GET /agenda', () => ({ status: 200, body: response([turno(), otherTurno]) })],
    ])
    renderAgenda()
    await screen.findByText('Paciente Ficticio')
    await userEvent.click(screen.getByRole('button', { name: 'Lista' }))

    await userEvent.type(screen.getByRole('searchbox'), 'Paciente Ficticio{Enter}')

    expect(screen.queryByText('Paciente Secundario')).not.toBeInTheDocument()
    expect(requests.filter((request) => request.path.startsWith('/agenda'))).toHaveLength(1)
    expect(requests.some((request) => request.path.startsWith('/pacientes'))).toBe(false)
  })

  it('defaults to calendar when the stored view preference is invalid', async () => {
    localStorage.setItem(AGENDA_VIEW_STORAGE_KEY, 'calendar')
    mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([turno()]) })]])
    renderAgenda()

    expect(await screen.findByRole('list', { name: 'Turnos del día' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Calendario' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('preserves backend appointment order and selected detail in calendar view', async () => {
    const orderedTurnos = [
      turno({ id: 'later-from-backend', estado: 'CONFIRMADO', fueraDisponibilidad: true, inicio: '2027-03-10T14:00:00.000Z', finAtencion: '2027-03-10T14:40:00.000Z', finBloqueo: '2027-03-10T14:50:00.000Z' }),
      turno({ id: 'earlier-from-backend', estado: 'CANCELADO', inicio: '2027-03-10T12:00:00.000Z', finAtencion: '2027-03-10T12:40:00.000Z', finBloqueo: '2027-03-10T12:50:00.000Z' }),
    ]
    mockApi([
      ['GET /sillones', () => ({ status: 200, body: chairs })],
      ['GET /agenda', () => ({ status: 200, body: response(orderedTurnos, { dias: [{ fecha: '2027-03-10', tramos: [{ horaInicio: '09:00', horaFin: '13:00' }], bloqueos: [{ id: 'block-demo', tipo: 'FERIADO', motivo: 'Bloqueo ficticio', horaInicio: null, horaFin: null }] }] }) })],
    ])
    renderAgenda()
    await screen.findAllByText('Paciente Ficticio')

    const grid = screen.getByRole('list', { name: 'Turnos del día' })
    expect(Array.from(grid.querySelectorAll('[data-turno-id]')).map((row) => row.getAttribute('data-turno-id')))
      .toEqual(['later-from-backend', 'earlier-from-backend'])
    expect(within(grid).getByText('Intervalo 11:40–11:50')).toBeInTheDocument()
    expect(within(grid).getByText('Intervalo 09:40–09:50')).toBeInTheDocument()
    expect(grid.querySelector('[data-status="CONFIRMADO"]')).toBeInTheDocument()
    expect(grid.querySelector('[data-status="CANCELADO"]')).toBeInTheDocument()
    expect(within(grid).getByText('Fuera de disponibilidad')).toBeInTheDocument()
    expect(screen.getByText('Feriado')).toBeInTheDocument()
    await userEvent.click(within(grid).getAllByRole('button')[0])
    expect(screen.getByRole('complementary', { name: 'Detalle del turno' })).toBeInTheDocument()
    expect(within(grid).getAllByRole('button')[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the backend schedule and blocks visible for an empty calendar day', async () => {
    mockApi([
      ['GET /sillones', () => ({ status: 200, body: chairs })],
      ['GET /agenda', () => ({
        status: 200,
        body: response([], {
          dias: [{
            fecha: '2027-03-10',
            tramos: [{ horaInicio: '09:00', horaFin: '13:00' }],
            bloqueos: [{ id: 'block-demo', tipo: 'FERIADO', motivo: 'Feriado ficticio', horaInicio: null, horaFin: null }],
          }],
        }),
      })],
    ])
    renderAgenda()
    await screen.findByText('No hay turnos para esta fecha')

    expect(screen.getByText('Disponibilidad: 09:00–13:00')).toBeInTheDocument()
    expect(screen.getByText('Feriado ficticio')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Turnos del día' })).not.toBeInTheDocument()
    expect(screen.getByText('No hay turnos para esta fecha')).toBeInTheDocument()
  })

  it('muestra vacío sin filtros y vacío con filtros', async () => {
    mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([]) })]])
    renderAgenda()
    expect(await screen.findByText('No hay turnos para esta fecha')).toBeTruthy()
    cleanup()
    renderAgenda('/agenda?fecha=2027-03-10&estado=AUSENTE')
    expect(await screen.findByText('Ningún turno coincide con los filtros')).toBeTruthy()
  })

  it('no consulta si no hay estados marcados', async () => {
    const { requests } = mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([]) })]])
    renderAgenda('/agenda?fecha=2027-03-10&estado=ninguno')
    expect((await screen.findAllByText(/al menos un estado/i)).length).toBeGreaterThan(0)
    expect(requests.some((r) => r.path.startsWith('/agenda'))).toBe(false)
  })

  it('muestra error con reintento', async () => {
    let calls = 0
    mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => (++calls === 1 ? apiError(500, 'INTERNAL', 'x') : { status: 200, body: response([turno()]) })]])
    renderAgenda()
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Paciente Ficticio')).toBeTruthy()
  })

  it('un refresco fallido conserva los datos previos', async () => {
    let calls = 0
    const { requests } = mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => (++calls === 1 ? { status: 200, body: response([turno()]) } : apiError(500, 'INTERNAL', 'x'))]])
    renderAgenda()
    await screen.findByText('Paciente Ficticio')
    expect(screen.getByRole('list', { name: 'Turnos del día' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Paciente Ficticio')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Turnos del día' })).toBeInTheDocument()
    expect(requests.filter((request) => request.path.startsWith('/agenda')).map((request) => request.path))
      .toEqual(['/agenda?desde=2027-03-01&hasta=2027-03-31', '/agenda?desde=2027-03-01&hasta=2027-03-31'])
  })

  it('abre el detalle sin pedir más datos y lo cierra con Esc', async () => {
    const { requests } = mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([turno({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia' })]) })]])
    renderAgenda()
    await userEvent.click(await screen.findByRole('button', { name: /Paciente Ficticio/ }))
    const detail = screen.getByRole('complementary', { name: 'Detalle del turno' })
    expect(within(detail).getByText('Urgencia')).toBeTruthy()
    expect(within(detail).getByRole('link', { name: 'Gestionar turno' }).getAttribute('href')).toBe('/turnos/t1')
    const before = requests.length
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Detalle del turno' })).toBeNull())
    expect(requests.length).toBe(before)
  })

  it('un rango rechazado se informa sin reintento', async () => {
    mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => apiError(400, 'AGENDA_RANGE_INVALID', 'x')]])
    renderAgenda()
    expect(await screen.findByText('Fecha rechazada')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })

  it('envía sillón y estados al backend', async () => {
    const { requests } = mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([]) })]])
    renderAgenda('/agenda?fecha=2027-03-10&sillon=s1&estado=CONFIRMADO,AUSENTE')
    await screen.findByText('Ningún turno coincide con los filtros')
    const agendaRequest = requests.find((r) => r.path.startsWith('/agenda'))
    expect(agendaRequest?.path).toContain('sillonId=s1')
    expect(decodeURIComponent(agendaRequest?.path ?? '')).toContain('estado=CONFIRMADO,AUSENTE')
    await userEvent.click(screen.getByRole('button', { name: 'Lista' }))
    expect(requests.filter((request) => request.path.startsWith('/agenda'))).toHaveLength(1)
  })
})

describe('estilos locales de agenda', () => {
  it('usa tokens del tema y reglas responsive para ambas representaciones', () => {
    expect(agendaCss).toContain('@media (min-width: 640px)')
    expect(agendaCss).toContain('@media (min-width: 1024px)')
    expect(agendaCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(agendaCss).not.toMatch(/rgba?\(/)
    expect(agendaCss).toContain('var(--color-surface)')
    expect(agendaCss).toContain('var(--color-text)')
  })
})
