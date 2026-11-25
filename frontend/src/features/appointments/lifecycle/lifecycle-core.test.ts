import { describe, expect, it } from 'vitest'
import { ApiClientError } from '../../../shared/api/client'
import { mockApi } from '../../catalog/test-utils'
import { lifecycleApi } from './api'
import { toLifecycleProblem } from './errors'
import { CLINIC_TIME_ZONE, formatLocalDate, formatLocalRange, formatLocalShortDate, formatLocalTime, toLocalDateTimeInput } from './time'

describe('formato local del ciclo de vida', () => {
  it('presenta un instante UTC en la hora de Argentina', () => {
    expect(CLINIC_TIME_ZONE).toBe('America/Argentina/Buenos_Aires')
    expect(formatLocalTime('2027-03-10T13:00:00.000Z')).toBe('10:00')
  })

  it('usa la fecha local, que puede diferir de la fecha UTC', () => {
    expect(formatLocalDate('2027-03-11T02:30:00.000Z')).toMatch(/10 de marzo de 2027/)
    expect(formatLocalTime('2027-03-11T02:30:00.000Z')).toBe('23:30')
    expect(formatLocalRange('2027-03-11T02:30:00.000Z', '2027-03-11T02:55:00.000Z')).toBe('23:30–23:55')
    expect(toLocalDateTimeInput('2027-03-11T02:30:00.000Z')).toEqual({ fecha: '2027-03-10', horaInicio: '23:30' })
    expect(formatLocalShortDate('2027-03-11T02:30:00.000Z')).toBe('10/03/2027')
    expect(formatLocalShortDate('2027-01-01T03:00:00.000Z')).toBe('01/01/2027')
  })
})

describe('mapeo neutral de errores del ciclo de vida', () => {
  it('ubica un VALIDATION_ERROR en el motivo sin repetir el mensaje del servidor', () => {
    const error = new ApiClientError('Paciente Ficticio Uno dni 11222333', 400, 'VALIDATION_ERROR', 'req-test', { campo: 'motivo' })
    expect(toLifecycleProblem(error)).toEqual({ kind: 'field', field: 'motivo', message: 'Ingresá un motivo de 1 a 500 caracteres.' })
  })

  it('traduce los rechazos operativos sin filtrar mensajes ni datos del servidor', () => {
    const apiError = (code: string, details?: ApiClientError['details']) =>
      new ApiClientError('Paciente Ficticio Uno dni 11222333 correo paciente@example.test', 409, code, 'req-test', details)

    expect(toLifecycleProblem(apiError('APPOINTMENT_CONFLICT', { conflictos: [{ turnoId: 'otro' }] }))).toEqual({
      kind: 'conflict',
      message: 'El horario ya está ocupado. Elegí otro horario.',
    })
    expect(toLifecycleProblem(apiError('APPOINTMENT_OUTSIDE_AVAILABILITY', {
      requiereOverrideManual: true,
      inicio: '2027-03-10T21:00:00.000Z',
      finAtencion: '2027-03-10T21:30:00.000Z',
    }))).toEqual({
      kind: 'outside',
      message: 'El horario está fuera de la disponibilidad; confirmá la excepción con un motivo.',
      inicio: '2027-03-10T21:00:00.000Z',
      finAtencion: '2027-03-10T21:30:00.000Z',
    })
    expect(toLifecycleProblem(apiError('APPOINTMENT_NOT_FOUND'))).toEqual({
      kind: 'notFound',
      message: 'El turno ya no existe.',
    })
    expect(toLifecycleProblem(new TypeError('fetch failed con dni 11222333'))).toEqual({
      kind: 'generic',
      message: 'No se pudo completar la operación. Intentá de nuevo en unos segundos.',
    })
    expect(JSON.stringify(toLifecycleProblem(apiError('APPOINTMENT_BLOCKED_BY_EXCEPTION', { motivoExcepcion: 'dni 11222333' })))).not.toContain('11222333')
  })
})

describe('cliente HTTP del ciclo de vida', () => {
  const appointment = {
    id: 'turno-1',
    pacienteId: 'paciente-1',
    prestacionId: 'prestacion-1',
    sillonId: 'sillon-1',
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

  it('consulta el detalle y el historial bajo /turnos/:id', async () => {
    const { requests } = mockApi([
      ['GET /turnos/turno-1/historial', () => ({ status: 200, body: { turnoId: 'turno-1', eventos: [] } })],
      ['GET /turnos/turno-1', () => ({ status: 200, body: { turno: appointment, historial: [] } })],
    ])

    expect((await lifecycleApi.getAppointment('turno-1')).turno.id).toBe('turno-1')
    expect((await lifecycleApi.getHistory('turno-1')).eventos).toEqual([])
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      'GET /turnos/turno-1',
      'GET /turnos/turno-1/historial',
    ])
  })

  it('envía las tres mutaciones al endpoint acordado y devuelve turno con historial', async () => {
    const response = { turno: appointment, historial: [] }
    const { requests } = mockApi([
      ['PATCH /turnos/turno-1/reprogramar', () => ({ status: 200, body: response })],
      ['PATCH /turnos/turno-1/cancelar', () => ({ status: 200, body: response })],
      ['PATCH /turnos/turno-1/estado', () => ({ status: 200, body: response })],
    ])

    const rescheduled = await lifecycleApi.reschedule('turno-1', { fecha: '2027-03-12', horaInicio: '11:00', motivo: 'Motivo ficticio' })
    await lifecycleApi.cancel('turno-1', { motivo: 'Motivo ficticio' })
    await lifecycleApi.changeStatus('turno-1', { estado: 'CONFIRMADO' })

    expect(rescheduled.turno.estado).toBe('PROGRAMADO')
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      'PATCH /turnos/turno-1/reprogramar',
      'PATCH /turnos/turno-1/cancelar',
      'PATCH /turnos/turno-1/estado',
    ])
    expect(requests[0].body).toEqual({ fecha: '2027-03-12', horaInicio: '11:00', motivo: 'Motivo ficticio' })
    expect(requests[2].body).toEqual({ estado: 'CONFIRMADO' })
    expect(requests.some((request) => request.path.includes('disponibilidad'))).toBe(false)
  })
})
