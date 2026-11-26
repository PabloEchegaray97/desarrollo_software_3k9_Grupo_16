import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppointmentCreationPage } from '.'
import { AppRoutes } from '../../../app/routes'
import { apiError, mockApi, page, type RecordedRequest } from '../../catalog/test-utils'

const sileoMocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sileo', () => ({ sileo: sileoMocks }))

const PATIENT = { id: 'pa-1', nombre: 'Paciente Ficticio Uno', telefono: '11 5555-0001', dni: null, email: null, activo: true, createdAt: '', updatedAt: '' }
const PROCEDURE_GLOBAL = { id: 'pr-1', nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: null, activo: true, createdAt: '', updatedAt: '' }
const PROCEDURE_OWN = { id: 'pr-2', nombre: 'Limpieza ficticia', duracionPredeterminadaMinutos: 45, intervaloPosteriorMinutos: 5, activo: true, createdAt: '', updatedAt: '' }
const CHAIR_A = { id: 'ch-1', nombre: 'Sillón A', activo: true, createdAt: '', updatedAt: '' }
const CHAIR_B = { id: 'ch-2', nombre: 'Sillón B', activo: true, createdAt: '', updatedAt: '' }
const AGENDA = {
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  desde: '2027-03-01',
  hasta: '2027-03-31',
  generadoEn: '2027-03-01T12:00:00.000Z',
  turnos: [],
  dias: [{ fecha: '2027-03-10', tramos: [{ horaInicio: '08:00', horaFin: '18:00' }], bloqueos: [] }],
}

const created = (overrides: Record<string, unknown> = {}) => ({
  id: 'turno-1',
  pacienteId: PATIENT.id,
  prestacionId: PROCEDURE_GLOBAL.id,
  sillonId: CHAIR_A.id,
  estado: 'PROGRAMADO',
  inicio: '2027-03-10T13:00:00.000Z',
  finAtencion: '2027-03-10T13:30:00.000Z',
  finBloqueo: '2027-03-10T13:40:00.000Z',
  duracionMinutos: 30,
  intervaloPosteriorMinutos: 10,
  fueraDisponibilidad: false,
  motivoExcepcion: null,
  createdAt: '2027-03-01T12:00:00.000Z',
  ...overrides,
})

type Handler = Parameters<typeof mockApi>[0][number][1]

function setup(postTurnos: Handler = () => ({ status: 201, body: created() }), extra: Array<[string, Handler]> = []) {
  return mockApi([
    ...extra,
    ['GET /prestaciones', () => ({ status: 200, body: page([PROCEDURE_GLOBAL, PROCEDURE_OWN]) })],
    ['GET /sillones', () => ({ status: 200, body: page([CHAIR_A, CHAIR_B]) })],
    ['GET /disponibilidad/configuracion', () => ({ status: 200, body: { intervaloGlobalMinutos: 10, zonaHoraria: 'America/Argentina/Buenos_Aires' } })],
    ['GET /agenda', () => ({ status: 200, body: AGENDA })],
    ['GET /pacientes', () => ({ status: 200, body: page([PATIENT]) })],
    ['POST /turnos', postTurnos],
  ])
}

const renderPage = () => render(<MemoryRouter><AppointmentCreationPage /></MemoryRouter>)

async function fillForm(options: { procedure?: string; chair?: string; date?: string; time?: string; selectPatient?: boolean } = {}) {
  const user = userEvent.setup()
  await userEvent.selectOptions(await screen.findByLabelText('Prestación'), options.procedure ?? PROCEDURE_GLOBAL.id)
  await userEvent.selectOptions(screen.getByLabelText('Sillón'), options.chair ?? CHAIR_A.id)
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  const date = options.date ?? '2027-03-10'
  const day = Number(date.slice(-2))
  await user.click(await screen.findByRole('button', { name: `Seleccionar día ${day}` }))
  await user.click(await screen.findByRole('button', { name: options.time ?? '10:00' }))
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  if (options.selectPatient !== false) {
    await user.click(await screen.findByRole('button', { name: /Paciente Ficticio Uno/ }))
  }
}

async function confirmBooking() {
  await userEvent.click(screen.getByRole('button', { name: 'Agendar turno' }))
  const dialog = await screen.findByRole('dialog', { name: 'Confirmar turno' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar turno' }))
}

const posts = (requests: RecordedRequest[]) => requests.filter((request) => request.method === 'POST' && request.path === '/turnos')

function CurrentPath() {
  const location = useLocation()
  return <output aria-label="Ruta actual">{location.pathname}</output>
}

// La configuración compartida de Vitest no habilita `globals`, por lo que RTL no limpia automáticamente.
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2027-03-01T15:00:00.000Z'))
})

describe('AppointmentCreationPage — opciones y formulario', () => {
  it('carga pacientes recientes y permite buscar dentro del primer paso', async () => {
    const { requests } = setup()
    renderPage()
    await fillForm({ selectPatient: false })

    const patientRequests = () => requests.filter((request) => request.path.startsWith('/pacientes'))
    const search = await screen.findByRole('searchbox', { name: 'Buscar paciente' })
    await screen.findByRole('button', { name: /Paciente Ficticio Uno/ })
    expect(patientRequests().map((request) => request.path)).toEqual(['/pacientes?pageSize=20'])

    await userEvent.type(search, 'Paciente Ficticio Uno')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await screen.findByRole('button', { name: /Paciente Ficticio Uno/ })

    expect(patientRequests().map((request) => request.path)).toEqual([
      '/pacientes?pageSize=20',
      '/pacientes?q=Paciente+Ficticio+Uno&pageSize=20',
    ])

    await userEvent.click(screen.getByRole('button', { name: /Paciente Ficticio Uno/ }))
    expect(screen.getByRole('button', { name: 'Agendar turno' })).toBeEnabled()
  })

  it('carga solo opciones activas y muestra los valores de referencia de la prestación elegida', async () => {
    const { requests } = setup()
    renderPage()

    const procedure = await screen.findByLabelText('Prestación')
    expect(within(procedure).getByRole('option', { name: 'Control ficticio · 30 min' })).toBeInTheDocument()
    expect(requests.filter((request) => request.method === 'GET').every((request) => !request.path.includes('incluirInactivos'))).toBe(true)

    await userEvent.selectOptions(procedure, PROCEDURE_GLOBAL.id)
    await userEvent.click(screen.getByText('Ajustes opcionales'))
    expect(screen.getByLabelText('Duración (min)')).toHaveAttribute('placeholder', '30')
    expect(screen.getByLabelText('Intervalo posterior (min)')).toHaveAttribute('placeholder', '10')
  })

  it('marca los campos obligatorios y no envía la solicitud', async () => {
    const { requests } = setup()
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

    expect(screen.getByLabelText('Prestación')).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Buscar paciente' })).not.toBeInTheDocument()
    expect(posts(requests)).toHaveLength(0)
  })

  it('muestra error con reintento si fallan las opciones', async () => {
    let calls = 0
    setup(undefined, [['GET /sillones', () => (++calls === 1 ? apiError(500, 'INTERNAL_ERROR', 'Unexpected server error') : { status: 200, body: page([CHAIR_A]) })]])
    renderPage()

    expect(await screen.findByText('No se pudieron cargar las opciones')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByLabelText('Prestación')).toBeInTheDocument()
  })
})

describe('AppointmentCreationPage — envío al backend', () => {
  it('envía sin decidir disponibilidad y muestra el resumen en hora local', async () => {
    const { requests } = setup()
    renderPage()
    await fillForm()
    await confirmBooking()

    expect(await screen.findByRole('heading', { name: /Turno registrado/ })).toBeInTheDocument()
    expect(posts(requests).map((request) => request.body)).toEqual([
      { pacienteId: 'pa-1', prestacionId: 'pr-1', sillonId: 'ch-1', fecha: '2027-03-10', horaInicio: '10:00' },
    ])
    expect(requests.some((request) => request.path.startsWith('/disponibilidad/evaluacion'))).toBe(false)
    expect(screen.getByText('10:00 a 10:30 · 30 min')).toBeInTheDocument()
    expect(screen.getByText('10:40 · intervalo de 10 min')).toBeInTheDocument()
    expect(screen.getByText(/miércoles.*10 de marzo de 2027/)).toBeInTheDocument()
    expect(screen.getByText('Sillón A')).toBeInTheDocument()
  })

  it('el detalle final ofrece únicamente cerrar', async () => {
    setup()
    renderPage()
    await fillForm()
    await confirmBooking()

    expect(await screen.findByRole('heading', { name: /Turno registrado/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear otro turno' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reprogramar' })).not.toBeInTheDocument()
  })

  it('creates inside the route modal and opens the dedicated appointment page from the summary', async () => {
    const { requests } = setup()
    render(
      <MemoryRouter initialEntries={['/turnos/nuevo']}>
        <AppRoutes />
        <CurrentPath />
      </MemoryRouter>,
    )
    const user = userEvent.setup()
    await fillForm()
    await confirmBooking()

    expect(await screen.findByRole('heading', { name: /Turno registrado/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(document.querySelectorAll('.apt-summary__item dt svg')).toHaveLength(6)
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts(requests)).toHaveLength(1)
  })

  it('fuera de disponibilidad: exige motivo y reenvía con override', async () => {
    let calls = 0
    const { requests } = setup(() =>
      ++calls === 1
        ? apiError(409, 'APPOINTMENT_OUTSIDE_AVAILABILITY', 'Fuera de disponibilidad', { requiereOverrideManual: true, inicio: '2027-03-10T21:00:00.000Z', finAtencion: '2027-03-10T21:30:00.000Z' })
        : { status: 201, body: created({ inicio: '2027-03-10T21:00:00.000Z', finAtencion: '2027-03-10T21:30:00.000Z', finBloqueo: '2027-03-10T21:40:00.000Z', fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' }) },
    )
    renderPage()
    await fillForm({ time: '17:30' })
    await confirmBooking()

    const dialog = await screen.findByRole('dialog', { name: 'Horario fuera de la disponibilidad' })
    expect(dialog).toHaveAccessibleDescription(/18:00–18:30/)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar como excepción' }))
    expect(within(dialog).getByText('Ingresá el motivo de la excepción.')).toBeInTheDocument()
    expect(posts(requests)).toHaveLength(1)

    await userEvent.type(within(dialog).getByLabelText(/Motivo de la excepción/), '  Urgencia ficticia ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar como excepción' }))

    expect(await screen.findByText('Fuera de disponibilidad')).toBeInTheDocument()
    expect(screen.getByText('Urgencia ficticia')).toBeInTheDocument()
    expect(posts(requests).map((request) => request.body)).toEqual([
      { pacienteId: 'pa-1', prestacionId: 'pr-1', sillonId: 'ch-1', fecha: '2027-03-10', horaInicio: '17:30' },
      { pacienteId: 'pa-1', prestacionId: 'pr-1', sillonId: 'ch-1', fecha: '2027-03-10', horaInicio: '17:30', fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' },
    ])
  })

  it('cancelar la excepción conserva el formulario y no crea el turno', async () => {
    const { requests } = setup(() => apiError(409, 'APPOINTMENT_OUTSIDE_AVAILABILITY', 'Fuera', { requiereOverrideManual: true, inicio: '2027-03-10T21:00:00.000Z', finAtencion: '2027-03-10T21:30:00.000Z' }))
    renderPage()
    await fillForm({ time: '17:30' })
    await confirmBooking()
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Volver al formulario' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText(/2027-03-10.*17:30 hs/)).toBeInTheDocument()
    expect(screen.getByText('Paciente Ficticio Uno')).toBeInTheDocument()
    expect(posts(requests)).toHaveLength(1)
  })

  it('explica un conflicto con otro turno del odontólogo con hora local y sillón', async () => {
    setup(() => apiError(409, 'APPOINTMENT_CONFLICT', 'Conflicto', {
      alcance: 'ODONTOLOGO',
      conflictos: [{ turnoId: 'otro', sillonId: CHAIR_B.id, inicio: '2027-03-10T13:00:00.000Z', finBloqueo: '2027-03-10T13:40:00.000Z' }],
    }))
    renderPage()
    await fillForm({ time: '10:15' })
    await confirmBooking()

    expect(sileoMocks.error).toHaveBeenCalledWith({
      title: 'Ya hay otro turno del odontólogo en ese horario',
      description: '10:00–10:40 · Sillón B',
    })
    expect(screen.getByText(/2027-03-10.*10:15 hs/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un día bloqueado se explica sin ofrecer la excepción', async () => {
    setup(() => apiError(409, 'APPOINTMENT_BLOCKED_BY_EXCEPTION', 'Bloqueado', { tipoExcepcion: 'FERIADO', motivoExcepcion: 'Feriado ficticio' }))
    renderPage()
    await fillForm()
    await confirmBooking()

    expect(sileoMocks.error).toHaveBeenCalledWith({
      title: 'Fecha bloqueada por un feriado',
      description: 'Motivo: Feriado ficticio.',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('una referencia inactiva se muestra junto a su campo', async () => {
    setup(() => apiError(422, 'APPOINTMENT_REFERENCE_INVALID', 'El sillón está inactivo', { campo: 'sillonId', motivo: 'INACTIVO' }))
    renderPage()
    await fillForm()
    await confirmBooking()

    expect(sileoMocks.error).toHaveBeenCalledWith({
      title: 'Datos inválidos',
      description: 'El sillón está inactivo. Elegí otro.',
    })
  })

  it('un inicio pasado se muestra junto a la hora', async () => {
    setup(() => apiError(422, 'APPOINTMENT_IN_PAST', 'Pasado'))
    renderPage()
    await fillForm()
    await confirmBooking()

    expect(sileoMocks.error).toHaveBeenCalledWith({
      title: 'Datos inválidos',
      description: 'Ese horario ya pasó. Elegí un inicio futuro.',
    })
  })
})
