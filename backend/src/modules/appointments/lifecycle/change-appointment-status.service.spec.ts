import { jest } from '@jest/globals';
import type { EntityManager } from 'typeorm';
import { FixedClock } from '../core/clock.js';
import type { AppointmentWriter, NewAppointmentEvent } from '../core/database/appointment-writer.js';
import type { AppointmentTransactionContext } from '../core/database/typeorm-transaction-boundary.js';
import type { AppointmentStatus } from '../core/domain/appointment-status.js';
import { AppointmentEntity } from '../core/entities/appointment.entity.js';
import { AppointmentEventEntity } from '../core/entities/appointment-event.entity.js';
import { ChangeAppointmentStatusDto } from './dto/change-appointment-status.dto.js';
import { LifecycleError } from './lifecycle-errors.js';
import type { AppointmentTransactions } from './lifecycle-transaction.js';
import { ChangeAppointmentStatusService } from './change-appointment-status.service.js';

const ID = 'd1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d';
const START = new Date('2027-03-10T13:00:00.000Z');
const BEFORE = new Date(START.getTime() - 1);
const AFTER = new Date(START.getTime() + 60_000);

function appointment(status: AppointmentStatus = 'PROGRAMADO'): AppointmentEntity {
  return Object.assign(new AppointmentEntity(), {
    id: ID,
    patientId: '3d2a0c74-9f20-4da0-9f5c-4b3e7a8c9d02',
    procedureId: '1b0f8a52-7d0e-4b8e-9d3a-2f1c5e6a7b80',
    chairId: '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91',
    startsAt: START,
    careEndsAt: new Date(START.getTime() + 30 * 60_000),
    blockEndsAt: new Date(START.getTime() + 40 * 60_000),
    durationMinutes: 30,
    postIntervalMinutes: 10,
    status,
    outsideAvailability: false,
    exceptionReason: null,
    cancellationReason: null,
    createdAt: new Date('2027-03-01T10:00:00.000Z'),
    updatedAt: new Date('2027-03-01T10:00:00.000Z'),
  });
}

function setup(options: { status?: AppointmentStatus; now?: Date; failOnEvents?: Error } = {}) {
  const steps: string[] = [];
  const state: { current: AppointmentEntity; events: AppointmentEventEntity[]; committed: boolean } = {
    current: appointment(options.status ?? 'PROGRAMADO'),
    events: [
      Object.assign(new AppointmentEventEntity(), {
        id: '11111111-1111-4111-8111-111111111111',
        appointmentId: ID,
        type: 'CREADO' as const,
        occurredAt: new Date('2027-03-01T10:00:00.000Z'),
        previousStatus: null,
        newStatus: 'PROGRAMADO' as const,
        previousStartsAt: null,
        newStartsAt: START,
        previousChairId: null,
        newChairId: '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91',
        reason: null,
      }),
    ],
    committed: false,
  };

  const manager = {
    update: jest.fn(async (_entity: unknown, _id: string, patch: object) => {
      steps.push('update');
      Object.assign(state.current, patch);
    }),
    find: jest.fn(async () => {
      steps.push('history');
      return state.events;
    }),
  } as unknown as EntityManager;

  const findAppointment = jest.fn(async () => {
    steps.push('load');
    return appointment(state.current.status);
  });
  const insertEvents = jest.fn(async (_manager: EntityManager, events: readonly NewAppointmentEvent[]) => {
    steps.push('events');
    if (options.failOnEvents) throw options.failOnEvents;
    state.events.push(...events.map((event) => Object.assign(new AppointmentEventEntity(), event)));
  });
  const writer = { findAppointment, insertEvents } as unknown as AppointmentWriter;

  const transactions: AppointmentTransactions = {
    run: async <T>(work: (context: AppointmentTransactionContext) => Promise<T>): Promise<T> => {
      const previous = appointment(state.current.status);
      const previousEvents = [...state.events];
      try {
        const result = await work({
          manager,
          acquireLock: async () => {
            steps.push('lock');
          },
          lockSnapshot: () => ({ globalIntervalMinutes: 10 }),
        });
        state.committed = true;
        return result;
      } catch (error: unknown) {
        state.current = previous;
        state.events = previousEvents;
        throw error;
      }
    },
  };

  const clock = new FixedClock(options.now ?? BEFORE);
  const service = new ChangeAppointmentStatusService(transactions, clock, writer);
  return {
    service,
    clock,
    steps,
    insertEvents,
    get committed() {
      return state.committed;
    },
    get current() {
      return state.current;
    },
    get events() {
      return state.events;
    },
  };
}

function input(estado: string = 'CONFIRMADO'): ChangeAppointmentStatusDto {
  return Object.assign(new ChangeAppointmentStatusDto(), {
    estado: estado as ChangeAppointmentStatusDto['estado'],
  });
}

async function caught(promise: Promise<unknown>): Promise<LifecycleError> {
  const error: unknown = await promise.catch((value: unknown) => value);
  expect(error).toBeInstanceOf(LifecycleError);
  return error as LifecycleError;
}

describe('ChangeAppointmentStatusService', () => {
  it('confirma antes del inicio sin restricción temporal y registra CAMBIO_ESTADO sin motivo', async () => {
    const fixture = setup({ now: BEFORE });

    const response = await fixture.service.changeStatus(ID, input('CONFIRMADO'));

    expect(fixture.steps).toEqual(['lock', 'load', 'update', 'events', 'load', 'history']);
    expect(fixture.current.status).toBe('CONFIRMADO');
    expect(fixture.events.at(-1)).toMatchObject({
      type: 'CAMBIO_ESTADO',
      previousStatus: 'PROGRAMADO',
      newStatus: 'CONFIRMADO',
      reason: null,
      occurredAt: BEFORE,
    });
    expect(response.turno.estado).toBe('CONFIRMADO');
    expect(response.historial.at(-1)).toMatchObject({ tipo: 'CAMBIO_ESTADO', motivo: null });
  });

  it('rechaza ATENDIDO un milisegundo antes del inicio con 422 y detalles UTC', async () => {
    const fixture = setup({ now: BEFORE });

    const error = await caught(fixture.service.changeStatus(ID, input('ATENDIDO')));

    expect(error.getStatus()).toBe(422);
    expect(error.code).toBe('APPOINTMENT_TOO_EARLY');
    expect(error.details).toEqual({ inicio: START.toISOString(), ahora: BEFORE.toISOString() });
    expect(fixture.insertEvents).not.toHaveBeenCalled();
    expect(fixture.committed).toBe(false);

    const absence = setup({ now: BEFORE });
    const absenceError = await caught(absence.service.changeStatus(ID, input('AUSENTE')));
    expect(absenceError.code).toBe('APPOINTMENT_TOO_EARLY');
    expect(absenceError.details).toEqual({ inicio: START.toISOString(), ahora: BEFORE.toISOString() });
  });

  it('acepta ATENDIDO exactamente en el inicio', async () => {
    const fixture = setup({ now: new Date(START.getTime()) });

    const response = await fixture.service.changeStatus(ID, input('ATENDIDO'));

    expect(response.turno.estado).toBe('ATENDIDO');
    expect(fixture.events.at(-1)).toMatchObject({ type: 'CAMBIO_ESTADO', newStatus: 'ATENDIDO', occurredAt: START });

    const absence = setup({ now: new Date(START.getTime()) });
    const absenceResponse = await absence.service.changeStatus(ID, input('AUSENTE'));
    expect(absenceResponse.turno.estado).toBe('AUSENTE');
    expect(absence.events.at(-1)).toMatchObject({ type: 'CAMBIO_ESTADO', newStatus: 'AUSENTE' });
  });

  it('usa el reloj inyectable para aceptar AUSENTE desde un CONFIRMADO después del inicio', async () => {
    const fixture = setup({ status: 'CONFIRMADO', now: AFTER });

    await fixture.service.changeStatus(ID, input('AUSENTE'));

    expect(fixture.current.status).toBe('AUSENTE');
    expect(fixture.events.at(-1)).toMatchObject({ previousStatus: 'CONFIRMADO', newStatus: 'AUSENTE' });
    fixture.clock.set(new Date(START.getTime() + 120_000));
    expect(fixture.clock.now()).toEqual(new Date(START.getTime() + 120_000));
  });

  it('rechaza transiciones inválidas con 409 sin modificar el turno', async () => {
    const repeated = setup({ status: 'CONFIRMADO' });
    const first = await caught(repeated.service.changeStatus(ID, input('CONFIRMADO')));
    expect(first.code).toBe('APPOINTMENT_INVALID_TRANSITION');
    expect(first.details).toEqual({ estadoActual: 'CONFIRMADO', operacion: 'CAMBIAR_ESTADO' });

    const terminal = setup({ status: 'CANCELADO', now: AFTER });
    const second = await caught(terminal.service.changeStatus(ID, input('ATENDIDO')));
    expect(second.code).toBe('APPOINTMENT_INVALID_TRANSITION');
    expect(second.details).toEqual({ estadoActual: 'CANCELADO', operacion: 'CAMBIAR_ESTADO' });
    expect(terminal.steps).toEqual(['lock', 'load']);
  });

  it('rechaza CANCELADO por /estado con 400 antes de abrir la transacción', async () => {
    const fixture = setup();

    const error = await caught(fixture.service.changeStatus(ID, input('CANCELADO')));

    expect(error.getStatus()).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(fixture.steps).toEqual([]);
  });

  it('revierte el cambio si falla la escritura del evento', async () => {
    const failure = new Error('historial no disponible');
    const fixture = setup({ now: AFTER, failOnEvents: failure });

    const error = await fixture.service.changeStatus(ID, input('ATENDIDO')).catch((value: unknown) => value);

    expect(error).toBe(failure);
    expect(fixture.committed).toBe(false);
    expect(fixture.current.status).toBe('PROGRAMADO');
    expect(fixture.events.map((event) => event.type)).toEqual(['CREADO']);
  });
});
