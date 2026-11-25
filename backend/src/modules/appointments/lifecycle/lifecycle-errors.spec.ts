import { HttpStatus } from '@nestjs/common';
import type { ConflictReport } from '../core/domain/appointment-policy.js';
import {
  toLifecycleResponse,
  type LifecycleAppointmentResponse,
  type LifecycleEventResponse,
} from './dto/appointment-lifecycle-response.js';
import {
  appointmentNotFound,
  blockedByException,
  invalidTime,
  invalidTransition,
  outsideAvailability,
  referenceInvalid,
  scheduleConflict,
  tooEarly,
  validationError,
  type LifecycleError,
  type LifecycleErrorPayload,
} from './lifecycle-errors.js';

function payloadOf(error: LifecycleError): LifecycleErrorPayload {
  return error.getResponse() as LifecycleErrorPayload;
}

const conflictReport: ConflictReport = {
  scope: 'SILLON',
  conflicts: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      chairId: '22222222-2222-4222-8222-222222222222',
      status: 'PROGRAMADO',
      startsAt: new Date('2027-03-10T13:00:00.000Z'),
      blockEndsAt: new Date('2027-03-10T13:35:00.000Z'),
    },
  ],
};

describe('scheduleConflict', () => {
  it('publica solo datos operativos, sin identidad de paciente', () => {
    const error = scheduleConflict(conflictReport);
    const payload = payloadOf(error);
    expect(payload.code).toBe('APPOINTMENT_CONFLICT');
    expect(payload.details?.conflictos).toEqual([
      {
        turnoId: '11111111-1111-4111-8111-111111111111',
        sillonId: '22222222-2222-4222-8222-222222222222',
        inicio: '2027-03-10T13:00:00.000Z',
        finBloqueo: '2027-03-10T13:35:00.000Z',
      },
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/paciente|documento|tel[eé]fono|correo|cl[ií]nic/i);
  });

  it('informa el alcance ODONTOLOGO con los mismos campos neutrales', () => {
    const payload = payloadOf(scheduleConflict({ ...conflictReport, scope: 'ODONTOLOGO' }));
    expect(payload.details?.alcance).toBe('ODONTOLOGO');
    expect(Object.keys(payload.details ?? {})).toEqual(['alcance', 'conflictos']);
  });
});

describe('invalidTransition', () => {
  it('publica estado y operación, nunca datos de paciente', () => {
    const payload = payloadOf(invalidTransition('CONFIRMADO', 'CANCELAR'));
    expect(payload.code).toBe('APPOINTMENT_INVALID_TRANSITION');
    expect(payload.details).toEqual({ estadoActual: 'CONFIRMADO', operacion: 'CANCELAR' });
    expect(JSON.stringify(payload)).not.toMatch(/paciente|documento|tel[eé]fono|correo|cl[ií]nic/i);
  });

  it('varía el estado y la operación informados', () => {
    const payload = payloadOf(invalidTransition('ATENDIDO', 'REPROGRAMAR'));
    expect(payload.details).toEqual({ estadoActual: 'ATENDIDO', operacion: 'REPROGRAMAR' });
  });
});

describe('códigos y estados HTTP del ciclo de vida', () => {
  it.each([
    [validationError('motivo', 'Motivo inválido'), 'VALIDATION_ERROR', HttpStatus.BAD_REQUEST],
    [invalidTime(), 'APPOINTMENT_INVALID_TIME', HttpStatus.BAD_REQUEST],
    [appointmentNotFound(), 'APPOINTMENT_NOT_FOUND', HttpStatus.NOT_FOUND],
    [outsideAvailabilityFixture(), 'APPOINTMENT_OUTSIDE_AVAILABILITY', HttpStatus.CONFLICT],
    [blockedByException('FERIADO', null), 'APPOINTMENT_BLOCKED_BY_EXCEPTION', HttpStatus.CONFLICT],
    [referenceInvalid('sillonId', 'INACTIVO'), 'APPOINTMENT_REFERENCE_INVALID', HttpStatus.UNPROCESSABLE_ENTITY],
    [tooEarly(new Date('2027-03-10T13:00:00Z'), new Date('2027-03-10T12:00:00Z')), 'APPOINTMENT_TOO_EARLY', HttpStatus.UNPROCESSABLE_ENTITY],
  ])('publica %s con código y estado correctos', (error, code, status) => {
    expect(payloadOf(error).code).toBe(code);
    expect(error.getStatus()).toBe(status);
  });
});

function outsideAvailabilityFixture() {
  const startsAt = new Date('2027-03-10T13:00:00Z');
  return outsideAvailability({ startsAt, careEndsAt: new Date('2027-03-10T13:30:00Z'), blockEndsAt: new Date('2027-03-10T13:35:00Z') });
}

describe('toLifecycleResponse', () => {
  const turno: LifecycleAppointmentResponse = {
    id: '33333333-3333-4333-8333-333333333333',
    pacienteId: '44444444-4444-4444-8444-444444444444',
    prestacionId: '55555555-5555-4555-8555-555555555555',
    sillonId: '22222222-2222-4222-8222-222222222222',
    estado: 'CANCELADO',
    inicio: '2027-03-10T13:00:00.000Z',
    finAtencion: '2027-03-10T13:30:00.000Z',
    finBloqueo: '2027-03-10T13:35:00.000Z',
    duracionMinutos: 30,
    intervaloPosteriorMinutos: 5,
    fueraDisponibilidad: false,
    motivoExcepcion: null,
    createdAt: '2027-03-09T10:00:00.000Z',
    motivoCancelacion: 'Motivo ficticio',
    updatedAt: '2027-03-09T11:00:00.000Z',
  };

  const historial: LifecycleEventResponse[] = [
    {
      id: '66666666-6666-4666-8666-666666666666',
      tipo: 'CANCELADO',
      ocurridoEn: '2027-03-09T11:00:00.000Z',
      estadoAnterior: 'CONFIRMADO',
      estadoNuevo: 'CANCELADO',
      inicioAnterior: null,
      inicioNuevo: null,
      sillonAnteriorId: null,
      sillonNuevoId: null,
      motivo: 'Motivo ficticio',
    },
  ];

  it('compone la respuesta de mutación conservando el orden del historial', () => {
    expect(toLifecycleResponse(turno, historial)).toEqual({ turno, historial });
  });

  it('devuelve un arreglo de historial vacío sin caer en undefined', () => {
    expect(toLifecycleResponse(turno, [])).toEqual({ turno, historial: [] });
  });

  it('no reordena los eventos ya cronológicos', () => {
    const first = historial[0];
    if (!first) throw new Error('Fixture incompleto');
    const segundo: LifecycleEventResponse = { ...first, id: '77777777-7777-4777-8777-777777777777', tipo: 'CAMBIO_ESTADO', motivo: null };
    const respuesta = toLifecycleResponse(turno, [segundo, first]);
    expect(respuesta.historial.map((evento) => evento.id)).toEqual([segundo.id, first.id]);
  });
});
