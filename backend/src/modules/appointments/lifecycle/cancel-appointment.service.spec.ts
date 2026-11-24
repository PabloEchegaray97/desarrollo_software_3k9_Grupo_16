import { jest } from '@jest/globals';
import { EntityNotFoundError, type EntityManager } from 'typeorm';
import { FixedClock } from '../core/clock.js';
import type { AppointmentWriter, NewAppointmentEvent } from '../core/database/appointment-writer.js';
import type { AppointmentTransactionContext } from '../core/database/typeorm-transaction-boundary.js';
import type { AppointmentStatus } from '../core/domain/appointment-status.js';
import { AppointmentEntity } from '../core/entities/appointment.entity.js';
import { AppointmentEventEntity } from '../core/entities/appointment-event.entity.js';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import { LifecycleError } from './lifecycle-errors.js';
import type { AppointmentTransactions } from './lifecycle-transaction.js';
import { CancelAppointmentService } from './cancel-appointment.service.js';

const ID = 'c1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d';
const NOW = new Date('2027-03-01T12:00:00.000Z');
const START = new Date('2027-03-10T13:00:00.000Z');

function appointment(status: AppointmentStatus = 'CONFIRMADO', cancellationReason: string | null = null): AppointmentEntity {
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
    cancellationReason,
    createdAt: new Date('2027-03-01T10:00:00.000Z'),
    updatedAt: new Date('2027-03-01T10:00:00.000Z'),
  });
}

function setup(options: { status?: AppointmentStatus; missing?: boolean; failOnEvents?: Error } = {}) {
  const steps: string[] = [];
  const state: { current: AppointmentEntity; events: AppointmentEventEntity[]; committed: boolean } = {
    current: appointment(options.status ?? 'CONFIRMADO'),
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
    if (options.missing) throw new EntityNotFoundError(AppointmentEntity, { id: ID });
    return appointment(state.current.status, state.current.cancellationReason);
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

  const service = new CancelAppointmentService(transactions, new FixedClock(NOW), writer);
  return {
    service,
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

function input(motivo = 'Motivo ficticio de cancelación'): CancelAppointmentDto {
  return Object.assign(new CancelAppointmentDto(), { motivo });
}

async function caught(promise: Promise<unknown>): Promise<LifecycleError> {
  const error: unknown = await promise.catch((value: unknown) => value);
  expect(error).toBeInstanceOf(LifecycleError);
  return error as LifecycleError;
}

describe('CancelAppointmentService', () => {
  it('cancela con motivo normalizado, escribe cancellation_reason y el evento CANCELADO', async () => {
    const fixture = setup();

    const response = await fixture.service.cancel(ID, input('  Motivo   ficticio  '));

    expect(fixture.steps).toEqual(['lock', 'load', 'update', 'events', 'load', 'history']);
    expect(fixture.current).toMatchObject({ status: 'CANCELADO', cancellationReason: 'Motivo ficticio' });
    expect(fixture.events.at(-1)).toMatchObject({
      type: 'CANCELADO',
      previousStatus: 'CONFIRMADO',
      newStatus: 'CANCELADO',
      reason: 'Motivo ficticio',
      occurredAt: NOW,
    });
    expect(response.turno).toMatchObject({ estado: 'CANCELADO', motivoCancelacion: 'Motivo ficticio' });
    expect(response.historial.at(-1)).toMatchObject({ tipo: 'CANCELADO', motivo: 'Motivo ficticio' });
    expect(fixture.committed).toBe(true);

    const fromScheduled = setup({ status: 'PROGRAMADO' });
    await fromScheduled.service.cancel(ID, input('Otro motivo ficticio'));
    expect(fromScheduled.current).toMatchObject({ status: 'CANCELADO', cancellationReason: 'Otro motivo ficticio' });
    expect(fromScheduled.events.at(-1)).toMatchObject({
      type: 'CANCELADO',
      previousStatus: 'PROGRAMADO',
      newStatus: 'CANCELADO',
      reason: 'Otro motivo ficticio',
    });
  });

  it('rechaza un motivo ausente o vacío con 400 antes de abrir la transacción', async () => {
    const empty = setup();
    const first = await caught(empty.service.cancel(ID, input('   ')));
    expect(first.getStatus()).toBe(400);
    expect(first.code).toBe('VALIDATION_ERROR');
    expect(first.details).toEqual({ campo: 'motivo' });
    expect(empty.steps).toEqual([]);

    const blank = setup();
    const second = await caught(blank.service.cancel(ID, input('')));
    expect(second.code).toBe('VALIDATION_ERROR');
    expect(blank.insertEvents).not.toHaveBeenCalled();

    const tooLong = setup();
    const third = await caught(tooLong.service.cancel(ID, input('x'.repeat(501))));
    expect(third.code).toBe('VALIDATION_ERROR');
    expect(third.details).toEqual({ campo: 'motivo' });
    expect(tooLong.steps).toEqual([]);
  });

  it('rechaza cancelar un estado terminal y un turno inexistente', async () => {
    const terminal = setup({ status: 'ATENDIDO' });
    const transition = await caught(terminal.service.cancel(ID, input()));
    expect(transition.code).toBe('APPOINTMENT_INVALID_TRANSITION');
    expect(transition.details).toEqual({ estadoActual: 'ATENDIDO', operacion: 'CANCELAR' });
    expect(terminal.steps).toEqual(['lock', 'load']);

    const missing = setup({ missing: true });
    const notFound = await caught(missing.service.cancel(ID, input()));
    expect(notFound.getStatus()).toBe(404);
    expect(notFound.code).toBe('APPOINTMENT_NOT_FOUND');
  });

  it('revierte estado y evento si falla la escritura del historial', async () => {
    const failure = new Error('historial no disponible');
    const fixture = setup({ failOnEvents: failure });

    const error = await fixture.service.cancel(ID, input()).catch((value: unknown) => value);

    expect(error).toBe(failure);
    expect(fixture.committed).toBe(false);
    expect(fixture.current.status).toBe('CONFIRMADO');
    expect(fixture.current.cancellationReason).toBeNull();
    expect(fixture.events.map((event) => event.type)).toEqual(['CREADO']);
  });
});
