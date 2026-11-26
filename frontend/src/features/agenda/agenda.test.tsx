import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, mockApi, page } from '../catalog/test-utils'
import { notifyAppointmentsChanged } from '../appointments/events'
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
    expect(screen.getByText('10:00 - 10:40')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Turnos del día' })).getByText('Programado')).toBeTruthy()
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
    expect(requests.filter((request) => request.path.startsWith('/agenda'))).toHaveLength(2)
    expect(requests.some((request) => request.path.startsWith('/agenda/proximos?desde='))).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: /^10:00.*Paciente Ficticio/ }))
    expect(screen.getByRole('complementary', { name: 'Detalle del turno' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Paciente Ficticio' })).not.toBeInTheDocument()

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
    expect(requests.filter((request) => request.path.startsWith('/agenda'))).toHaveLength(2)
    expect(requests.some((request) => request.path.startsWith('/agenda/proximos?desde='))).toBe(true)
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

  it('fuerza la vista calendario desde el acceso Hoy aunque la preferencia guardada sea lista', async () => {
    localStorage.setItem(AGENDA_VIEW_STORAGE_KEY, 'list')
    mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([turno()]) })]])
    renderAgenda('/agenda?fecha=2027-03-10&vista=calendario')

    expect(await screen.findByText('Paciente Ficticio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calendario' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('abre las acciones de cada turno con clic secundario y con los tres puntos', async () => {
    mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([turno()]) })]])
    renderAgenda()

    await screen.findByText('Paciente Ficticio')
    const appointment = screen.getByRole('button', { name: /^10:00.*Paciente Ficticio/ })
    fireEvent.contextMenu(appointment, { clientX: 320, clientY: 240 })
    expect(screen.getByRole('menu', { name: /Acciones del turno de Paciente Ficticio/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Ver detalle' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Reprogramar' })).toBeEnabled()
    expect(screen.getByRole('menuitem', { name: 'Cancelar' })).toBeEnabled()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir acciones de Paciente Ficticio' }))
    expect(screen.getByRole('menu', { name: /Acciones del turno de Paciente Ficticio/ })).toBeInTheDocument()
  })

  it('abre el mismo bottom sheet de acciones al tocar un turno en móvil y no restaura el foco al cerrarlo', async () => {
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
    mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([turno()]) })]])
    renderAgenda()

    const appointment = await screen.findByRole('button', { name: /^10:00.*Paciente Ficticio/ })
    await userEvent.click(appointment)

    const sheet = screen.getByRole('dialog', { name: 'Acciones del turno' })
    expect(within(sheet).getByText('Paciente Ficticio')).toBeInTheDocument()
    expect(within(sheet).getByText('Horario')).toBeInTheDocument()
    expect(within(sheet).getByText('Turno')).toBeInTheDocument()
    expect(within(sheet).getByRole('menuitem', { name: 'Ver detalle' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Detalle del turno' })).not.toBeInTheDocument()

    await userEvent.click(within(sheet).getByRole('button', { name: 'Cerrar acciones del turno' }))
    expect(appointment).not.toHaveFocus()
  })

  it('abre los turnos del día en un bottom sheet al elegir una fecha del calendario móvil', async () => {
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
    mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([turno()]) })]])
    renderAgenda()

    await screen.findByText('Paciente Ficticio')
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar día 10' }))

    const daySheet = screen.getByRole('dialog', { name: /miércoles, 10 de marzo de 2027/i })
    const appointment = within(daySheet).getByRole('button', { name: /^10:00.*Paciente Ficticio/ })
    expect(appointment).toBeInTheDocument()

    await userEvent.click(appointment)
    expect(screen.getByRole('dialog', { name: 'Acciones del turno' })).toBeInTheDocument()
  })

  it('preserves backend appointment order and opens selected detail in a calendar modal', async () => {
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
    expect(within(grid).getByText('11:00 - 11:40')).toBeInTheDocument()
    expect(within(grid).getByText('09:00 - 09:40')).toBeInTheDocument()
    expect(grid.querySelector('[data-status="CONFIRMADO"]')).toBeInTheDocument()
    expect(grid.querySelector('[data-status="CANCELADO"]')).toBeInTheDocument()
    expect(within(grid).getByText('Fuera de disponibilidad')).toBeInTheDocument()
    expect(screen.getByText('Feriado')).toBeInTheDocument()
    await userEvent.click(within(grid).getAllByRole('button')[0])
    expect(screen.getByRole('dialog', { name: 'Paciente Ficticio' })).toBeInTheDocument()
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
    await screen.findByText('La agenda está libre este día.')

    expect(screen.getByText('Disponibilidad: 09:00–13:00')).toBeInTheDocument()
    expect(screen.getByText('Feriado ficticio')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Turnos del día' })).not.toBeInTheDocument()
    expect(screen.getByText('La agenda está libre este día.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crear turno' })).toHaveAttribute('href', '/turnos/nuevo')
  })

  it('muestra vacío sin filtros y vacío con filtros', async () => {
    mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([]) })]])
    renderAgenda()
    expect(await screen.findByText('La agenda está libre este día.')).toBeTruthy()
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
    notifyAppointmentsChanged()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Paciente Ficticio')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Turnos del día' })).toBeInTheDocument()
    expect(requests.filter((request) => request.path.startsWith('/agenda')).map((request) => request.path))
      .toEqual(['/agenda?desde=2027-03-01&hasta=2027-03-31', '/agenda?desde=2027-03-01&hasta=2027-03-31'])
  })

  it('abre el detalle de calendario en un modal sin pedir más datos y lo cierra con Esc', async () => {
    const { requests } = mockApi([['GET /sillones', () => ({ status: 200, body: chairs })], ['GET /agenda', () => ({ status: 200, body: response([turno({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia' })]) })]])
    renderAgenda()
    await screen.findByText('Paciente Ficticio')
    await userEvent.click(screen.getByRole('button', { name: /^10:00.*Paciente Ficticio/ }))
    const detail = screen.getByRole('dialog', { name: 'Paciente Ficticio' })
    expect(within(detail).getByText('Urgencia')).toBeTruthy()
    expect(within(detail).getByRole('link', { name: 'Ver detalle' }).getAttribute('href')).toBe('/turnos/t1')
    expect(within(detail).getByRole('link', { name: 'Reprogramar' }).getAttribute('href')).toBe('/turnos/t1')
    expect(within(detail).getByRole('link', { name: 'Cancelar' }).getAttribute('href')).toBe('/turnos/t1')
    const before = requests.length
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Paciente Ficticio' })).toBeNull())
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
    expect(requests.filter((request) => request.path.startsWith('/agenda'))).toHaveLength(2)
    const upcomingRequest = requests.find((request) => request.path.startsWith('/agenda/proximos'))
    expect(upcomingRequest?.path).toContain('sillonId=s1')
    expect(decodeURIComponent(upcomingRequest?.path ?? '')).toContain('estado=CONFIRMADO,AUSENTE')
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
    expect(agendaCss).toContain('.agenda-detail--modal .agenda-detail__footer')
    expect(agendaCss).toContain('grid-template-columns: minmax(0, 1fr)')
  })
})
