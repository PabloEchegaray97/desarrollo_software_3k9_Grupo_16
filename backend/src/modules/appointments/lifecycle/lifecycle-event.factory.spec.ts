import type { RescheduleEventInput } from './lifecycle-event.factory.js';
import { buildCancelEvent, buildRescheduleEvents, buildStatusChangeEvent } from './lifecycle-event.factory.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

describe('buildRescheduleEvents (design § Evento por operación)', () => {
  it('reprogramar CONFIRMADO emite un solo REPROGRAMADO hacia PROGRAMADO', () => {
    const events = buildRescheduleEvents({
      appointmentId: '11111111-1111-4111-8111-111111111111',
      previousStatus: 'CONFIRMADO',
      previousStartsAt: new Date('2027-03-10T13:00:00.000Z'),
      newStartsAt: new Date('2027-03-11T14:00:00.000Z'),
      previousChairId: '22222222-2222-4222-8222-222222222222',
      newChairId: '33333333-3333-4333-8333-333333333333',
      reason: 'Motivo ficticio de reprogramación',
      occurredAt: new Date('2027-03-09T10:00:00.000Z'),
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toMatch(UUID);
    expect(events[0]).toMatchObject({
      appointmentId: '11111111-1111-4111-8111-111111111111',
      type: 'REPROGRAMADO',
      occurredAt: new Date('2027-03-09T10:00:00.000Z'),
      previousStatus: 'CONFIRMADO',
      newStatus: 'PROGRAMADO',
      previousStartsAt: new Date('2027-03-10T13:00:00.000Z'),
      newStartsAt: new Date('2027-03-11T14:00:00.000Z'),
      previousChairId: '22222222-2222-4222-8222-222222222222',
      newChairId: '33333333-3333-4333-8333-333333333333',
      reason: 'Motivo ficticio de reprogramación',
    });
  });

  const baseInput: RescheduleEventInput = {
    appointmentId: '11111111-1111-4111-8111-111111111111',
    previousStatus: 'PROGRAMADO',
    previousStartsAt: new Date('2027-03-10T13:00:00.000Z'),
    newStartsAt: new Date('2027-03-11T14:00:00.000Z'),
    previousChairId: '22222222-2222-4222-8222-222222222222',
    newChairId: '33333333-3333-4333-8333-333333333333',
    reason: 'Otro motivo ficticio',
    occurredAt: new Date('2027-03-09T10:00:00.000Z'),
  };

  it('reprogramar PROGRAMADO conserva PROGRAMADO como estado anterior y nuevo', () => {
    const events = buildRescheduleEvents(baseInput);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'REPROGRAMADO', previousStatus: 'PROGRAMADO', newStatus: 'PROGRAMADO' });
  });

  it('agrega EXCEPCION con su motivo y sin inicios ni sillones', () => {
    const events = buildRescheduleEvents({
      ...baseInput,
      previousStatus: 'CONFIRMADO',
      exceptionReason: 'Motivo ficticio de excepción',
    });
    expect(events.map((event) => event.type)).toEqual(['REPROGRAMADO', 'EXCEPCION']);
    expect(events[0]).toMatchObject({ newStatus: 'PROGRAMADO', reason: 'Otro motivo ficticio' });
    expect(events[1]).toMatchObject({
      previousStatus: null,
      newStatus: null,
      previousStartsAt: null,
      newStartsAt: null,
      previousChairId: null,
      newChairId: null,
      reason: 'Motivo ficticio de excepción',
      occurredAt: baseInput.occurredAt,
    });
  });
});

describe('buildCancelEvent', () => {
  it('registra CANCELADO con motivo y sin inicios ni sillones', () => {
    const event = buildCancelEvent({
      appointmentId: '11111111-1111-4111-8111-111111111111',
      previousStatus: 'CONFIRMADO',
      reason: 'Motivo ficticio de cancelación',
      occurredAt: new Date('2027-03-09T12:00:00.000Z'),
    });
    expect(event.id).toMatch(UUID);
    expect(event).toMatchObject({
      type: 'CANCELADO',
      previousStatus: 'CONFIRMADO',
      newStatus: 'CANCELADO',
      previousStartsAt: null,
      newStartsAt: null,
      previousChairId: null,
      newChairId: null,
      reason: 'Motivo ficticio de cancelación',
    });
  });
});

describe('buildStatusChangeEvent', () => {
  it('deja motivo en null al confirmar', () => {
    const event = buildStatusChangeEvent({
      appointmentId: '11111111-1111-4111-8111-111111111111',
      previousStatus: 'PROGRAMADO',
      newStatus: 'CONFIRMADO',
      occurredAt: new Date('2027-03-10T13:00:00.000Z'),
    });
    expect(event).toMatchObject({
      type: 'CAMBIO_ESTADO',
      previousStatus: 'PROGRAMADO',
      newStatus: 'CONFIRMADO',
      previousStartsAt: null,
      newStartsAt: null,
      previousChairId: null,
      newChairId: null,
      reason: null,
    });
  });

  it('también deja motivo en null al registrar ATENDIDO desde CONFIRMADO', () => {
    const event = buildStatusChangeEvent({
      appointmentId: '11111111-1111-4111-8111-111111111111',
      previousStatus: 'CONFIRMADO',
      newStatus: 'ATENDIDO',
      occurredAt: new Date('2027-03-10T13:01:00.000Z'),
    });
    expect(event).toMatchObject({ type: 'CAMBIO_ESTADO', newStatus: 'ATENDIDO', reason: null });
  });
});
