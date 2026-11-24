import { describe, expect, it } from 'vitest'
import { ApiClientError } from '../../../shared/api/client'
import { toBookingProblem } from './errors'
import { formatLocalDate, formatLocalRange, formatLocalTime } from './time'

describe('formato en la zona del consultorio', () => {
  it('presenta instantes UTC en hora de Argentina sin depender de la zona del navegador', () => {
    expect(formatLocalTime('2027-03-10T13:00:00.000Z')).toBe('10:00')
    expect(formatLocalTime('2027-03-11T02:30:00.000Z')).toBe('23:30')
    expect(formatLocalRange('2027-03-10T13:00:00.000Z', '2027-03-10T13:40:00.000Z')).toBe('10:00–10:40')
  })

  it('usa la fecha local, que puede diferir de la fecha UTC', () => {
    expect(formatLocalDate('2027-03-11T02:30:00.000Z')).toMatch(/10 de marzo de 2027/)
    expect(formatLocalDate('2027-03-10T13:00:00.000Z')).toMatch(/^miércoles/)
  })
})

const apiError = (status: number, code: string, details?: ApiClientError['details'], message = 'Mensaje del backend') =>
  new ApiClientError(message, status, code, 'request-test', details)

describe('toBookingProblem', () => {
  it('fuera de disponibilidad → flujo de excepción', () => {
    expect(toBookingProblem(apiError(409, 'APPOINTMENT_OUTSIDE_AVAILABILITY', { requiereOverrideManual: true, inicio: 'a', finAtencion: 'b' }))).toEqual({
      kind: 'outside',
      inicio: 'a',
      finAtencion: 'b',
    })
  })

  it('conflicto con alcance y turnos, descartando entradas mal formadas', () => {
    const conflict = { turnoId: 't', sillonId: 's', inicio: 'i', finBloqueo: 'f' }
    expect(toBookingProblem(apiError(409, 'APPOINTMENT_CONFLICT', { alcance: 'SILLON', conflictos: [conflict, { turnoId: 1 }] }))).toEqual({
      kind: 'conflict',
      scope: 'SILLON',
      conflicts: [conflict],
    })
    expect(toBookingProblem(apiError(409, 'APPOINTMENT_CONFLICT', {}))).toMatchObject({ scope: 'ODONTOLOGO', conflicts: [] })
  })

  it('día bloqueado', () => {
    expect(toBookingProblem(apiError(409, 'APPOINTMENT_BLOCKED_BY_EXCEPTION', { tipoExcepcion: 'FERIADO', motivoExcepcion: 'Feriado ficticio' }))).toEqual({
      kind: 'blocked',
      tipoExcepcion: 'FERIADO',
      motivoExcepcion: 'Feriado ficticio',
    })
  })

  it('referencia inválida, pasado y hora inválida van junto a su campo', () => {
    expect(toBookingProblem(apiError(422, 'APPOINTMENT_REFERENCE_INVALID', { campo: 'sillonId', motivo: 'INACTIVO' }))).toEqual({
      kind: 'fields',
      fields: { sillonId: 'El sillón está inactivo. Elegí otro.' },
    })
    expect(toBookingProblem(apiError(422, 'APPOINTMENT_IN_PAST'))).toEqual({ kind: 'fields', fields: { horaInicio: 'Ese horario ya pasó. Elegí un inicio futuro.' } })
    expect(toBookingProblem(apiError(400, 'APPOINTMENT_INVALID_TIME'))).toMatchObject({ kind: 'fields', fields: { fecha: expect.any(String) } })
  })

  it('errores de validación se ubican por campo', () => {
    expect(toBookingProblem(apiError(400, 'VALIDATION_ERROR', ['duracionMinutos must not be greater than 240']))).toEqual({
      kind: 'fields',
      fields: { duracionMinutos: 'La duración debe ser un número entero entre 1 y 240 minutos.' },
    })
  })

  it('errores de red o del servidor muestran un mensaje genérico', () => {
    expect(toBookingProblem(new TypeError('fetch failed'))).toMatchObject({ kind: 'generic', message: expect.stringMatching(/No se pudo registrar/) })
    expect(toBookingProblem(apiError(500, 'INTERNAL_ERROR'))).toMatchObject({ kind: 'generic', message: expect.stringMatching(/No se pudo registrar/) })
  })
})
