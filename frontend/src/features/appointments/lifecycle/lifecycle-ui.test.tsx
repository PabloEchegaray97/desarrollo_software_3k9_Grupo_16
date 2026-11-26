import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../../shared/api/client'
import { apiError, mockApi, page } from '../../catalog/test-utils'
import { AppointmentLifecyclePage } from '.'
import { CancelModal } from './CancelModal'
import { HistoryTimeline } from './HistoryTimeline'
import { RescheduleModal } from './RescheduleModal'
import { StatusActions } from './StatusActions'
import type { LifecycleAppointment, LifecycleEvent, LifecycleResponse, RescheduleInput } from './types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('StatusActions', () => {
  it('deshabilita todas las acciones en un estado terminal', () => {
    render(
      <StatusActions
        status="ATENDIDO"
        onReschedule={() => undefined}
        onCancel={() => undefined}
        onChangeStatus={() => undefined}
      />,
    )

    for (const name of ['Reprogramar', 'Cancelar turno', 'Confirmar', 'Marcar atendido', 'Registrar ausencia']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.getByText(/estado final/)).toBeInTheDocument()
  })

  it('en PROGRAMADO habilita la matriz y solicita cada acción con su estado', async () => {
    const onReschedule = vi.fn()
    const onCancel = vi.fn()
    const onChangeStatus = vi.fn()
    render(
      <StatusActions status="PROGRAMADO" onReschedule={onReschedule} onCancel={onCancel} onChangeStatus={onChangeStatus} />,
    )

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Marcar atendido' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reprogramar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }))

    expect(onChangeStatus.mock.calls).toEqual([['CONFIRMADO'], ['ATENDIDO']])
    expect(onReschedule).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('en CONFIRMADO bloquea una segunda confirmación sin bloquear atención ni ausencia', () => {
    render(
      <StatusActions status="CONFIRMADO" onReschedule={() => undefined} onCancel={() => undefined} onChangeStatus={() => undefined} />,
    )

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Marcar atendido' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Registrar ausencia' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Reprogramar' })).toBeEnabled()
  })
})

const event = (overrides: Partial<LifecycleEvent> & Pick<LifecycleEvent, 'tipo'>): LifecycleEvent => ({
  id: 'ev-1',
  ocurridoEn: '2027-03-10T13:00:00.000Z',
  estadoAnterior: null,
  estadoNuevo: null,
  inicioAnterior: null,
  inicioNuevo: null,
  sillonAnteriorId: null,
  sillonNuevoId: null,
  motivo: null,
  ...overrides,
})

const CHAIRS = [
  { id: 'sillon-11111111-aaaa', nombre: 'Sillón A', activo: true, createdAt: '', updatedAt: '' },
  { id: 'sillon-22222222-bbbb', nombre: 'Sillón B', activo: true, createdAt: '', updatedAt: '' },
]

describe('HistoryTimeline', () => {
  it('describe cada tipo de evento con horas locales y motivos autorizados', () => {
    const eventos: LifecycleEvent[] = [
      event({ id: '1', tipo: 'CREADO', inicioNuevo: '2027-03-10T13:00:00.000Z', sillonNuevoId: CHAIRS[0].id }),
      event({
        id: '2',
        tipo: 'REPROGRAMADO',
        estadoAnterior: 'CONFIRMADO',
        estadoNuevo: 'PROGRAMADO',
        inicioAnterior: '2027-03-10T13:00:00.000Z',
        inicioNuevo: '2027-03-10T14:00:00.000Z',
        sillonAnteriorId: CHAIRS[0].id,
        sillonNuevoId: CHAIRS[1].id,
        motivo: 'Reprogramación ficticia',
      }),
      event({ id: '3', tipo: 'CANCELADO', motivo: 'Cancelación ficticia' }),
      event({ id: '4', tipo: 'CAMBIO_ESTADO', estadoAnterior: 'PROGRAMADO', estadoNuevo: 'CONFIRMADO' }),
      event({ id: '5', tipo: 'EXCEPCION', motivo: 'Excepción ficticia' }),
    ]
    render(<HistoryTimeline eventos={eventos} chairs={CHAIRS} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items[0]).toHaveTextContent('Creación')
    expect(items[0]).toHaveTextContent('Sillón A')
    expect(items[1]).toHaveTextContent('Reprogramación')
    expect(items[1]).toHaveTextContent('10:00 → 11:00')
    expect(items[1]).toHaveTextContent('Sillón A → Sillón B')
    expect(items[1]).toHaveTextContent('CONFIRMADO → PROGRAMADO')
    expect(items[1]).toHaveTextContent('Reprogramación ficticia')
    expect(items[2]).toHaveTextContent('Cancelación ficticia')
    expect(items[3]).toHaveTextContent('PROGRAMADO → CONFIRMADO')
    expect(items[4]).toHaveTextContent('Excepción ficticia')
    expect(screen.getAllByText(/10 de marzo de 2027/)).toHaveLength(5)
  })

  it('muestra un estado vacío y un ID corto si el sillón ya no se resuelve', () => {
    const { rerender } = render(<HistoryTimeline eventos={[]} chairs={CHAIRS} />)
    expect(screen.getByText('Todavía no hay eventos')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    rerender(
      <HistoryTimeline
        eventos={[event({ tipo: 'CAMBIO_ESTADO', estadoAnterior: 'PROGRAMADO', estadoNuevo: 'CONFIRMADO', motivo: 'No aplica' })]}
        chairs={[]}
      />,
    )
    expect(screen.getByRole('listitem')).toHaveTextContent('PROGRAMADO → CONFIRMADO')
    expect(screen.getByRole('listitem')).not.toHaveTextContent('No aplica')

    rerender(
      <HistoryTimeline
        eventos={[event({ tipo: 'CREADO', inicioNuevo: '2027-03-10T13:00:00.000Z', sillonNuevoId: 'sillon-99999999-cccc' })]}
        chairs={[]}
      />,
    )
    expect(screen.getByRole('listitem')).toHaveTextContent('sillon-9…')
  })
})

describe('CancelModal', () => {
  it('exige un motivo no vacío y coloca el foco en el campo al abrir', async () => {
    const onConfirm = vi.fn(async () => undefined)
    render(<CancelModal open onClose={() => undefined} onConfirm={onConfirm} />)

    const reason = screen.getByLabelText('Motivo de la cancelación')
    await waitFor(() => expect(reason).toHaveFocus())

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá el motivo.')
    expect(reason).toHaveAttribute('aria-invalid', 'true')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('rechaza un motivo de más de 500 caracteres y envía uno normalizado', async () => {
    const onConfirm = vi.fn(async () => undefined)
    const onClose = vi.fn()
    render(<CancelModal open onClose={onClose} onConfirm={onConfirm} />)

    const reason = screen.getByLabelText('Motivo de la cancelación')
    fireEvent.change(reason, { target: { value: 'x'.repeat(501) } })
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }))
    expect(screen.getByRole('alert')).toHaveTextContent('El motivo no puede superar los 500 caracteres.')
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.change(reason, { target: { value: '  Motivo   ficticio  ' } })
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Motivo ficticio'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

const lifecycleCss = readFileSync(resolve(process.cwd(), 'src/features/appointments/lifecycle/lifecycle.css'), 'utf8')

const APPOINTMENT: LifecycleAppointment = {
  id: 'turno-1',
  pacienteId: 'paciente-1',
  prestacionId: 'prestacion-1',
  sillonId: CHAIRS[0].id,
  estado: 'PROGRAMADO',
  inicio: '2027-03-10T13:00:00.000Z',
  finAtencion: '2027-03-10T13:30:00.000Z',
  finBloqueo: '2027-03-10T13:40:00.000Z',
  duracionMinutos: 30,
  intervaloPosteriorMinutos: 10,
  fueraDisponibilidad: false,
  motivoExcepcion: null,
  motivoCancelacion: null,
  createdAt: '2027-03-01T12:00:00.000Z',
  updatedAt: '2027-03-01T12:00:00.000Z',
}

describe('RescheduleModal', () => {
  it('inicializa la hora local y rechaza motivos vacío y largo sin enviar nada', async () => {
    const onSave = vi.fn(async (_input: RescheduleInput) => undefined)
    render(<RescheduleModal open appointment={APPOINTMENT} chairs={CHAIRS} onClose={() => undefined} onSave={onSave} />)

    expect(screen.getByLabelText('Fecha')).toHaveValue('2027-03-10')
    expect(screen.getByLabelText('Hora de inicio')).toHaveValue('10:00')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar reprogramación' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá el motivo.')
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Motivo de la reprogramación'), { target: { value: 'x'.repeat(501) } })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reprogramación' }))
    expect(screen.getByRole('alert')).toHaveTextContent('El motivo no puede superar los 500 caracteres.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('pide una excepción confirmada cuando el backend rechaza por fuera de disponibilidad', async () => {
    const outside = new ApiClientError('Fuera de disponibilidad', 409, 'APPOINTMENT_OUTSIDE_AVAILABILITY', 'req-test', {
      requiereOverrideManual: true,
      inicio: '2027-03-10T21:00:00.000Z',
      finAtencion: '2027-03-10T21:30:00.000Z',
    })
    const onSave = vi.fn<(_input: RescheduleInput) => Promise<void>>()
      .mockRejectedValueOnce(outside)
      .mockResolvedValueOnce(undefined)
    const onClose = vi.fn()
    render(<RescheduleModal open appointment={APPOINTMENT} chairs={CHAIRS} onClose={onClose} onSave={onSave} />)

    await userEvent.type(screen.getByLabelText('Motivo de la reprogramación'), 'Cambio ficticio')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reprogramación' }))

    expect(await screen.findByText(/fuera de la disponibilidad/)).toBeInTheDocument()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Motivo de la excepción'), 'Excepción ficticia')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar excepción' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1][0]).toMatchObject({
      fecha: '2027-03-10',
      horaInicio: '10:00',
      motivo: 'Cambio ficticio',
      fueraDisponibilidad: true,
      motivoExcepcion: 'Excepción ficticia',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('envía el sillón solo si cambia y muestra un conflicto con mensaje neutral', async () => {
    const conflict = new ApiClientError('Paciente Ficticio Uno dni 11222333', 409, 'APPOINTMENT_CONFLICT', 'req-test')
    const onSave = vi.fn<(_input: RescheduleInput) => Promise<void>>().mockRejectedValueOnce(conflict).mockResolvedValueOnce(undefined)
    const onClose = vi.fn()
    render(<RescheduleModal open appointment={APPOINTMENT} chairs={CHAIRS} onClose={onClose} onSave={onSave} />)

    await userEvent.selectOptions(screen.getByLabelText('Sillón'), CHAIRS[1].id)
    await userEvent.type(screen.getByLabelText('Motivo de la reprogramación'), 'Cambio de sillón ficticio')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reprogramación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El horario ya está ocupado. Elegí otro horario.')
    expect(onSave.mock.calls[0][0].sillonId).toBe(CHAIRS[1].id)
    expect(onClose).not.toHaveBeenCalled()
    expect(JSON.stringify(onSave.mock.calls[0][0])).not.toContain('11222333')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar reprogramación' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})

const DETAIL_RESPONSE: LifecycleResponse = {
  turno: APPOINTMENT,
  historial: [event({ id: 'ev-created', tipo: 'CREADO', inicioNuevo: APPOINTMENT.inicio, sillonNuevoId: CHAIRS[0].id })],
}

const PATIENTS = [{
  id: APPOINTMENT.pacienteId,
  nombre: 'Paciente Ficticio Uno',
  telefono: '11 5555-0001',
  dni: '30000001',
  email: 'uno@example.test',
  activo: true,
  createdAt: '',
  updatedAt: '',
}]

const PROCEDURES = [{
  id: APPOINTMENT.prestacionId,
  nombre: 'Control ficticio',
  duracionPredeterminadaMinutos: 30,
  intervaloPosteriorMinutos: 10,
  activo: true,
  createdAt: '',
  updatedAt: '',
}]

const renderPage = () => render(
  <MemoryRouter initialEntries={['/turnos/turno-1']}>
    <Routes>
      <Route path="/turnos/:appointmentId" element={<AppointmentLifecyclePage />} />
    </Routes>
  </MemoryRouter>,
)

describe('AppointmentLifecyclePage', () => {
  it('carga el turno y el historial y los presenta en hora local', async () => {
    const { requests } = mockApi([
      ['GET /turnos/turno-1/historial', () => ({ status: 200, body: { turnoId: 'turno-1', eventos: DETAIL_RESPONSE.historial } })],
      ['GET /turnos/turno-1', () => ({ status: 200, body: DETAIL_RESPONSE })],
      ['GET /sillones', () => ({ status: 200, body: page(CHAIRS) })],
      ['GET /pacientes', () => ({ status: 200, body: page(PATIENTS) })],
      ['GET /prestaciones', () => ({ status: 200, body: page(PROCEDURES) })],
    ])
    renderPage()

    expect(screen.getByText(/Cargando turno/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Turno de Paciente Ficticio Uno' })).toBeInTheDocument()
    expect(screen.getAllByText(/10\/03\/2027/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sillón A').length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(screen.getByRole('list', { name: 'Historial del turno' })).toBeInTheDocument()
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      'GET /turnos/turno-1',
      'GET /turnos/turno-1/historial',
      'GET /sillones?pageSize=100',
      'GET /pacientes?incluirInactivos=true&pageSize=100',
      'GET /prestaciones?incluirInactivos=true&pageSize=100',
    ])
  })

  it('cancela con motivo, refleja la respuesta del backend y devuelve el foco al detalle', async () => {
    const cancelled: LifecycleResponse = {
      turno: { ...APPOINTMENT, estado: 'CANCELADO', motivoCancelacion: 'Motivo ficticio' },
      historial: [
        ...DETAIL_RESPONSE.historial,
        event({ id: 'ev-cancel', tipo: 'CANCELADO', motivo: 'Motivo ficticio' }),
      ],
    }
    const { requests } = mockApi([
      ['GET /turnos/turno-1/historial', () => ({ status: 200, body: { turnoId: 'turno-1', eventos: DETAIL_RESPONSE.historial } })],
      ['GET /turnos/turno-1', () => ({ status: 200, body: DETAIL_RESPONSE })],
      ['GET /sillones', () => ({ status: 200, body: page(CHAIRS) })],
      ['GET /pacientes', () => ({ status: 200, body: page(PATIENTS) })],
      ['GET /prestaciones', () => ({ status: 200, body: page(PROCEDURES) })],
      ['PATCH /turnos/turno-1/cancelar', () => ({ status: 200, body: cancelled })],
    ])
    renderPage()
    await screen.findByRole('heading', { name: 'Turno de Paciente Ficticio Uno' })

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar turno' })
    await userEvent.type(within(dialog).getByLabelText('Motivo de la cancelación'), 'Motivo ficticio')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelación' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Turno de Paciente Ficticio Uno' })).toHaveFocus())
    expect(screen.getAllByText('CANCELADO').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Motivo ficticio').length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(screen.getByRole('listitem', { name: /Cancelación/ })).toBeInTheDocument()
    expect(requests.find((request) => request.method === 'PATCH')?.body).toEqual({ motivo: 'Motivo ficticio' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra error con reintento y el estado vacío del historial', async () => {
    let calls = 0
    mockApi([
      ['GET /turnos/turno-1/historial', () => ({ status: 200, body: { turnoId: 'turno-1', eventos: [] } })],
      ['GET /turnos/turno-1', () => (++calls === 1
        ? apiError(500, 'INTERNAL_ERROR', 'Unexpected server error')
        : { status: 200, body: { turno: APPOINTMENT, historial: [] } })],
      ['GET /sillones', () => ({ status: 200, body: page(CHAIRS) })],
      ['GET /pacientes', () => ({ status: 200, body: page(PATIENTS) })],
      ['GET /prestaciones', () => ({ status: 200, body: page(PROCEDURES) })],
    ])
    renderPage()

    expect(await screen.findByText('No se pudo cargar el detalle del turno')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await userEvent.click(await screen.findByRole('tab', { name: 'Historial' }))
    expect(await screen.findByText('Todavía no hay eventos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Detalle' }))
    expect(screen.getByRole('button', { name: 'Cancelar turno' })).toBeEnabled()
  })
})

describe('estilos locales del ciclo de vida', () => {
  it('usa solo tokens aprobados y agrupa el movimiento tras prefers-reduced-motion', () => {
    expect(lifecycleCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(lifecycleCss).toMatch(/var\(--(?:space|color|radius|shadow|font|line|duration|ease|focus)[a-z0-9-]*\)/)
    expect(lifecycleCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(lifecycleCss).not.toMatch(/rgba?\(/)
    expect(lifecycleCss).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*transition: none/)
  })

  it('prefija todas las clases propias y usa tokens de duración dentro de la preferencia de movimiento', () => {
    expect(lifecycleCss).toContain('.lc-page')
    expect(lifecycleCss).toContain('.lc-detail')
    expect(lifecycleCss).toMatch(/transition:[^;]*var\(--duration-/)
    expect(lifecycleCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})
