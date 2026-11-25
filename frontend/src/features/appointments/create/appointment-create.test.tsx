import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppointmentCreationPage } from '.'
import { AppRoutes } from '../../../app/routes'
import { apiError, mockApi, page, type RecordedRequest } from '../../catalog/test-utils'

const PATIENT = { id: 'pa-1', nombre: 'Paciente Ficticio Uno', telefono: '11 5555-0001', dni: null, email: null, activo: true, createdAt: '', updatedAt: '' }
const PROCEDURE_GLOBAL = { id: 'pr-1', nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: null, activo: true, createdAt: '', updatedAt: '' }
const PROCEDURE_OWN = { id: 'pr-2', nombre: 'Limpieza ficticia', duracionPredeterminadaMinutos: 45, intervaloPosteriorMinutos: 5, activo: true, createdAt: '', updatedAt: '' }
const CHAIR_A = { id: 'ch-1', nombre: 'Sillón A', activo: true, createdAt: '', updatedAt: '' }
const CHAIR_B = { id: 'ch-2', nombre: 'Sillón B', activo: true, createdAt: '', updatedAt: '' }

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
    ['GET /pacientes', () => ({ status: 200, body: page([PATIENT]) })],
    ['POST /turnos', postTurnos],
  ])
}

const renderPage = () => render(<MemoryRouter><AppointmentCreationPage /></MemoryRouter>)

async function fillForm(options: { procedure?: string; chair?: string; date?: string; time?: string } = {}) {
  await userEvent.click(await screen.findByRole('button', { name: /Paciente Ficticio Uno/ }))
  await userEvent.selectOptions(screen.getByLabelText('Prestación'), options.procedure ?? PROCEDURE_GLOBAL.id)
  await userEvent.selectOptions(screen.getByLabelText('Sillón'), options.chair ?? CHAIR_A.id)
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: options.date ?? '2027-03-10' } })
  fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: options.time ?? '10:00' } })
}

const posts = (requests: RecordedRequest[]) => requests.filter((request) => request.method === 'POST' && request.path === '/turnos')

function CurrentPath() {
  const location = useLocation()
  return <output aria-label="Ruta actual">{location.pathname}</output>
}

// La configuración compartida de Vitest no habilita `globals`, por lo que RTL no limpia automáticamente.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AppointmentCreationPage — opciones y formulario', () => {
  it('carga solo opciones activas y muestra los valores de referencia de la prestación elegida', async () => {
    const { requests } = setup()
    renderPage()

    const procedure = await screen.findByLabelText('Prestación')
    expect(within(procedure).getByRole('option', { name: 'Control ficticio (30 min)' })).toBeInTheDocument()
    expect(requests.filter((request) => request.method === 'GET').every((request) => !request.path.includes('incluirInactivos'))).toBe(true)

    await userEvent.selectOptions(procedure, PROCEDURE_GLOBAL.id)
    expect(screen.getByText('Si lo dejás vacío se usa la de la prestación: 30 min. Máximo 240.')).toBeInTheDocument()
    expect(screen.getByText('Si lo dejás vacío se usa el intervalo global: 10 min. Máximo 30.')).toBeInTheDocument()

    await userEvent.selectOptions(procedure, PROCEDURE_OWN.id)
    expect(screen.getByText('Si lo dejás vacío se usa el de la prestación: 5 min. Máximo 30.')).toBeInTheDocument()
  })

  it('marca los campos obligatorios y no envía la solicitud', async () => {
    const { requests } = setup()
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar turno' }))

    for (const message of ['Elegí un paciente.', 'Elegí una prestación.', 'Elegí un sillón.', 'Elegí la fecha.', 'Elegí la hora de inicio.']) {
      expect(screen.getByText(message)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Prestación')).toHaveAttribute('aria-invalid', 'true')
    expect(posts(requests)).toHaveLength(0)
  })

  it('muestra error con reintento si fallan las opciones', async () => {
    let calls = 0
    setup(undefined, [['GET /sillones', () => (++calls === 1 ? apiError(500, 'INTERNAL_ERROR', 'Unexpected server error') : { status: 200, body: page([CHAIR_A]) })]])
    renderPage()

    expect(await screen.findByText('No se pudieron cargar las opciones')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByLabelText('Sillón')).toBeInTheDocument()
  })
})

describe('AppointmentCreationPage — envío al backend', () => {
  it('envía sin decidir disponibilidad y muestra el resumen en hora local', async () => {
    const { requests } = setup()
    renderPage()
    await fillForm()
    await userEvent.type(screen.getByLabelText(/Duración/), '30')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar turno' }))

    expect(await screen.findByRole('heading', { name: /Turno registrado/ })).toBeInTheDocument()
    expect(posts(requests).map((request) => request.body)).toEqual([
      { pacienteId: 'pa-1', prestacionId: 'pr-1', sillonId: 'ch-1', fecha: '2027-03-10', horaInicio: '10:00', duracionMinutos: 30 },
    ])
    expect(requests.some((request) => request.path.startsWith('/disponibilidad/evaluacion'))).toBe(false)
    expect(screen.getByText('10:00 a 10:30 (30 min)')).toBeInTheDocument()
    expect(screen.getByText('10:40 (intervalo de 10 min)')).toBeInTheDocument()
    expect(screen.getByText(/miércoles.*10 de marzo de 2027/)).toBeInTheDocument()
    expect(screen.getByText('Sillón A')).toBeInTheDocument()
  })

  it('crear otro turno vuelve a un formulario vacío', async () => {
    setup()
    renderPage()
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar turno' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Crear otro turno' }))

    expect(screen.getByLabelText('Prestación')).toHaveValue('')
    expect(screen.getByLabelText('Fecha')).toHaveValue('')
  })

  it('creates inside the route modal and opens the dedicated appointment page from the summary', async () => {
    const agenda = {
      zonaHoraria: 'America/Argentina/Buenos_Aires',
      desde: '2027-03-10',
      hasta: '2027-03-10',
      generadoEn: '2027-03-10T12:30:00.000Z',
      turnos: [],
      dias: [],
    }
    const { requests } = setup(undefined, [['GET /agenda', () => ({ status: 200, body: agenda })]])
    render(
      <MemoryRouter initialEntries={['/turnos/nuevo']}>
        <AppRoutes />
        <CurrentPath />
      </MemoryRouter>,
    )
    const user = userEvent.setup()
    await fillForm()
    await user.click(screen.getByRole('button', { name: 'Registrar turno' }))

    expect(await screen.findByRole('heading', { name: /Turno registrado/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Ver turno' }))

    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/turnos/turno-1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts(requests)).toHaveLength(1)
  })

  it('closes the successful summary back to the dashboard', async () => {
    const agenda = {
      zonaHoraria: 'America/Argentina/Buenos_Aires',
      desde: '2027-03-10',
      hasta: '2027-03-10',
      generadoEn: '2027-03-10T12:30:00.000Z',
      turnos: [],
      dias: [],
    }
    setup(undefined, [['GET /agenda', () => ({ status: 200, body: agenda })]])
    render(
      <MemoryRouter initialEntries={['/turnos/nuevo']}>
        <AppRoutes />
        <CurrentPath />
      </MemoryRouter>,
    )
    const user = userEvent.setup()
    await fillForm()
    await user.click(screen.getByRole('button', { name: 'Registrar turno' }))
    await screen.findByRole('heading', { name: /Turno registrado/ })

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/')
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('fuera de disponibilidad: exige motivo y reenvía con override', async () => {
    let calls = 0
    const { requests } = setup(() =>
      ++calls === 1
        ? apiError(409, 'APPOINTMENT_OUTSIDE_AVAILABILITY', 'Fuera de disponibilidad', { requiereOverrideManual: true, inicio: '2027-03-10T21:00:00.000Z', finAtencion: '2027-03-10T21:30:00.000Z' })
        : { status: 201, body: created({ inicio: '2027-03-10T21:00:00.000Z', finAtencion: '2027-03-10T21:30:00.000Z', finBloqueo: '2027-03-10T21:40:00.000Z', fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' }) },
    )
    renderPage()
    await fillForm({ time: '18:00' })
    await userEvent.click(screen.getByRole('button', { name: 'Registrar turno' }))

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
      { pacienteId: 'pa-1', prestacionId: 'pr-1', sillonId: 'ch-1', fecha: '2027-03-10', horaInicio: '18:00' },
      { pacienteId: 'pa-1', prestacionId: 'pr-1', sillonId: 'ch-1', fecha: '2027-03-10', horaInicio: '18:00', fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' },
    ])
  })

  it('cancelar la excepción conserva el formulario y no crea el turno', async () => {
    const { requests } = setup(() => apiError(409, 'APPOINTMENT_OUTSIDE_AVAILABILITY', 'Fuera', { requiereOverrideManual: true, inicio: '2027-03-10T21:00:00.000Z', finAtencion: '2027-03-10T21:30:00.000Z' }))
    renderPage()
    await fillForm({ time: '18:00' })
    await userEvent.click(screen.getByRole('button', { name: 'Registrar turno' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Volver al formulario' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Hora de inicio')).toHaveValue('18:00')
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
    await userEvent.click(screen.getByRole('button', { name: 'Registrar turno' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Ya hay otro turno del odontólogo en ese horario')
    expect(within(alert).getByRole('list', { name: 'Turnos en conflicto' })).toHaveTextContent('10:00–10:40 · Sillón B')
    expect(screen.getByLabelText('Hora de inicio')).toHaveValue('10:15')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un día bloqueado se explica sin ofrecer la excepción', async () => {
    setup(() => apiError(409, 'APPOINTMENT_BLOCKED_BY_EXCEPTION', 'Bloqueado', { tipoExcepcion: 'FERIADO', motivoExcepcion: 'Feriado ficticio' }))
    renderPage()
    await fillForm({ date: '2027-03-17' })
    await userEvent.click(screen.getByRole('button', { name: 'Registrar turno' }))

    expect(await screen.findByText('Esa fecha está bloqueada por un feriado')).toBeInTheDocument()
    expect(screen.getByText(/Motivo: Feriado ficticio/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('una referencia inactiva se muestra junto a su campo', async () => {
    setup(() => apiError(422, 'APPOINTMENT_REFERENCE_INVALID', 'El sillón está inactivo', { campo: 'sillonId', motivo: 'INACTIVO' }))
    renderPage()
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar turno' }))

    await waitFor(() => expect(screen.getByLabelText('Sillón')).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByText('El sillón está inactivo. Elegí otro.')).toBeInTheDocument()
  })

  it('un inicio pasado se muestra junto a la hora', async () => {
    setup(() => apiError(422, 'APPOINTMENT_IN_PAST', 'Pasado'))
    renderPage()
    await fillForm({ date: '2025-03-12' })
    await userEvent.click(screen.getByRole('button', { name: 'Registrar turno' }))

    expect(await screen.findByText('Ese horario ya pasó. Elegí un inicio futuro.')).toBeInTheDocument()
  })
})
