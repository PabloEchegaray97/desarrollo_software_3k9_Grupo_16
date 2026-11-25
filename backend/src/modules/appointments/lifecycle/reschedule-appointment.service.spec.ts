import { jest } from '@jest/globals';
import { EntityNotFoundError, type EntityManager } from 'typeorm';
import type { ResultadoEvaluacion } from '../../availability/domain/availability-policy.js';
import type { AvailabilityEvaluationPort, SolicitudEvaluacionPort } from '../../availability/availability.port.js';
import type { CatalogReferences, ChairReference } from '../../catalogs/catalog-references.js';
import { FixedClock } from '../core/clock.js';
import type { AppointmentWriter, NewAppointmentEvent } from '../core/database/appointment-writer.js';
import type { AppointmentTransactionContext } from '../core/database/typeorm-transaction-boundary.js';
import type { AppointmentEventType, AppointmentStatus } from '../core/domain/appointment-status.js';
import { AppointmentEntity } from '../core/entities/appointment.entity.js';
import { AppointmentEventEntity } from '../core/entities/appointment-event.entity.js';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto.js';
import { LifecycleError } from './lifecycle-errors.js';
import { RescheduleAppointmentService, type AppointmentTransactions } from './reschedule-appointment.service.js';

const APPOINTMENT_ID = 'a1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d';
const PATIENT_ID = '3d2a0c74-9f20-4da0-9f5c-4b3e7a8c9d02';
const PROCEDURE_ID = '1b0f8a52-7d0e-4b8e-9d3a-2f1c5e6a7b80';
const CHAIR_1 = '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91';
const CHAIR_2 = '5f4c2e96-b142-4fc2-b17e-6d5a9cafbe24';
const NOW = new Date('2027-03-01T12:00:00.000Z');
const START = new Date('2027-03-10T13:00:00.000Z');
const NEW_START = new Date('2027-03-12T13:00:00.000Z');

function appointment(overrides: Partial<AppointmentEntity> = {}): AppointmentEntity {
  return Object.assign(new AppointmentEntity(), {
    id: APPOINTMENT_ID,
    patientId: PATIENT_ID,
    procedureId: PROCEDURE_ID,
    chairId: CHAIR_1,
    startsAt: START,
    careEndsAt: new Date(START.getTime() + 30 * 60_000),
    blockEndsAt: new Date(START.getTime() + 40 * 60_000),
    durationMinutes: 30,
    postIntervalMinutes: 10,
    status: 'PROGRAMADO' as AppointmentStatus,
    outsideAvailability: false,
    exceptionReason: null,
    cancellationReason: null,
    createdAt: new Date('2027-03-01T10:00:00.000Z'),
    updatedAt: new Date('2027-03-01T10:00:00.000Z'),
  }, overrides);
}

function historyEvent(
  type: AppointmentEventType = 'CREADO',
  overrides: Partial<AppointmentEventEntity> = {},
): AppointmentEventEntity {
  return Object.assign(new AppointmentEventEntity(), {
    id: '11111111-1111-4111-8111-111111111111',
    appointmentId: APPOINTMENT_ID,
    type,
    occurredAt: new Date('2027-03-01T10:00:00.000Z'),
    previousStatus: null,
    newStatus: 'PROGRAMADO' as AppointmentStatus | null,
    previousStartsAt: null,
    newStartsAt: START,
    previousChairId: null,
    newChairId: CHAIR_1,
    reason: null,
    ...overrides,
  });
}

function evaluation(overrides: Partial<ResultadoEvaluacion> = {}): ResultadoEvaluacion {
  return {
    estado: 'DISPONIBLE',
    requiereOverrideManual: false,
    motivoExcepcion: null,
    tipoExcepcion: null,
    inicioUtc: NEW_START.toISOString(),
    finAtencionUtc: new Date(NEW_START.getTime() + 30 * 60_000).toISOString(),
    finBloqueoUtc: new Date(NEW_START.getTime() + 40 * 60_000).toISOString(),
    ...overrides,
  };
}

function input(overrides: Partial<RescheduleAppointmentDto> = {}): RescheduleAppointmentDto {
  return Object.assign(new RescheduleAppointmentDto(), {
    fecha: '2027-03-12',
    horaInicio: '10:00',
    motivo: 'Reunión ficticia de control',
    ...overrides,
  });
}

interface SetupOptions {
  current?: AppointmentEntity;
  appointments?: ReturnType<typeof appointment>[];
  events?: AppointmentEventEntity[];
  evaluacion?: ResultadoEvaluacion;
  chair?: ChairReference | null;
  failOnEvents?: Error;
  missing?: boolean;
}

function setup(options: SetupOptions = {}) {
  const steps: string[] = [];
  const state = {
    current: options.current ?? appointment(),
    events: options.events ?? [historyEvent()],
    committed: false,
  };

  const manager = {
    update: jest.fn(async (_entity: unknown, _id: string, patch: object) => {
      steps.push('update');
      Object.assign(state.current, patch);
    }),
    find: jest.fn(async (entity: unknown) => {
      if (entity === AppointmentEntity) {
        steps.push('conflicts');
        return options.appointments ?? [];
      }
      if (entity === AppointmentEventEntity) {
        steps.push('history');
        return state.events;
      }
      return [];
    }),
  } as unknown as EntityManager;

  const findAppointment = jest.fn(async () => {
    steps.push('load');
    if (options.missing) throw new EntityNotFoundError(AppointmentEntity, { id: APPOINTMENT_ID });
    return appointment(state.current);
  });
  const insertEvents = jest.fn(async (_manager: EntityManager, events: readonly NewAppointmentEvent[]) => {
    steps.push('events');
    if (options.failOnEvents) throw options.failOnEvents;
    state.events.push(...events.map((event) => historyEvent(event.type, event)));
  });
  const writer = { findAppointment, insertEvents } as unknown as AppointmentWriter;

  const transactions: AppointmentTransactions = {
    run: async <T>(work: (context: AppointmentTransactionContext) => Promise<T>): Promise<T> => {
      const previous = appointment(state.current);
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

  const evaluar = jest.fn(async (request: SolicitudEvaluacionPort) => {
    steps.push('evaluate');
    void request;
    return options.evaluacion ?? evaluation();
  });
  const availability: AvailabilityEvaluationPort = { evaluar };

  const findChairById = jest.fn(async (chairId: string, usedManager?: EntityManager) => {
    steps.push(usedManager === manager ? 'chair(tx)' : 'chair(no-tx)');
    if (options.chair !== undefined) return options.chair;
    return { id: chairId, nombre: 'Sillón ficticio', activo: true };
  });
  const catalogs = { findChairById } as unknown as CatalogReferences;

  const service = new RescheduleAppointmentService(transactions, new FixedClock(NOW), availability, catalogs, writer);
  return {
    service,
    steps,
    evaluar,
    findChairById,
    insertEvents,
    get committed() {
      return state.committed;
    },
    get events() {
      return state.events;
    },
    get current() {
      return state.current;
    },
  };
}

async function caught(promise: Promise<unknown>): Promise<LifecycleError> {
  const error: unknown = await promise.catch((value: unknown) => value);
  expect(error).toBeInstanceOf(LifecycleError);
  return error as LifecycleError;
}

describe('RescheduleAppointmentService', () => {
  it('reprograma conservando los minutos efectivos y devuelve turno con historial', async () => {
    const fixture = setup();

    const response = await fixture.service.reschedule(APPOINTMENT_ID, input());

    expect(fixture.steps).toEqual([
      'lock',
      'load',
      'evaluate',
      'conflicts',
      'update',
      'events',
      'load',
      'history',
    ]);
    expect(fixture.evaluar).toHaveBeenCalledWith({
      fecha: '2027-03-12',
      horaInicio: '10:00',
      duracionMinutos: 30,
      intervaloPosteriorMinutos: 10,
    });
    expect(response.turno).toMatchObject({
      id: APPOINTMENT_ID,
      estado: 'PROGRAMADO',
      duracionMinutos: 30,
      intervaloPosteriorMinutos: 10,
      inicio: NEW_START.toISOString(),
    });
    expect(response.historial.at(-1)).toMatchObject({ tipo: 'REPROGRAMADO', motivo: 'Reunión ficticia de control' });
    expect(fixture.committed).toBe(true);
  });

  it('responde 404 sin escribir eventos cuando el turno no existe', async () => {
    const fixture = setup({ missing: true });

    const error = await caught(fixture.service.reschedule(APPOINTMENT_ID, input()));

    expect(error.getStatus()).toBe(404);
    expect(error.code).toBe('APPOINTMENT_NOT_FOUND');
    expect(fixture.steps).toEqual(['lock', 'load']);
    expect(fixture.insertEvents).not.toHaveBeenCalled();
    expect(fixture.committed).toBe(false);
  });

  it('guarda como ordinario un override innecesario, sin bandera ni evento EXCEPCION', async () => {
    const fixture = setup();

    const response = await fixture.service.reschedule(
      APPOINTMENT_ID,
      input({ fueraDisponibilidad: true, motivoExcepcion: 'Justificación ficticia' }),
    );

    expect(response.turno).toMatchObject({ fueraDisponibilidad: false, motivoExcepcion: null });
    expect(fixture.events.filter((event) => event.type === 'EXCEPCION')).toHaveLength(0);
    expect(fixture.current).toMatchObject({ outsideAvailability: false, exceptionReason: null });
  });

  it('devuelve PROGRAMADO un CONFIRMADO con un único evento REPROGRAMADO', async () => {
    const fixture = setup({ current: appointment({ status: 'CONFIRMADO' }) });

    const response = await fixture.service.reschedule(APPOINTMENT_ID, input());

    expect(response.turno.estado).toBe('PROGRAMADO');
    expect(fixture.current.status).toBe('PROGRAMADO');
    expect(fixture.events.filter((event) => event.type === 'REPROGRAMADO')).toHaveLength(1);
    expect(fixture.events.at(-1)).toMatchObject({
      type: 'REPROGRAMADO',
      previousStatus: 'CONFIRMADO',
      newStatus: 'PROGRAMADO',
      reason: 'Reunión ficticia de control',
    });
    expect(fixture.events.some((event) => event.type === 'CAMBIO_ESTADO')).toBe(false);
  });

  it('cambia de sillón validándolo con el manager de la transacción', async () => {
    const fixture = setup();

    await fixture.service.reschedule(APPOINTMENT_ID, input({ sillonId: CHAIR_2 }));

    expect(fixture.findChairById).toHaveBeenCalledWith(CHAIR_2, expect.anything());
    expect(fixture.steps).toContain('chair(tx)');
    expect(fixture.current.chairId).toBe(CHAIR_2);
    expect(fixture.events.at(-1)).toMatchObject({ previousChairId: CHAIR_1, newChairId: CHAIR_2 });
  });

  it('rechaza un sillón inexistente o inactivo con 422 y campo sillonId', async () => {
    const missing = setup({ chair: null });
    const missingError = await caught(missing.service.reschedule(APPOINTMENT_ID, input({ sillonId: CHAIR_2 })));
    expect(missingError.getStatus()).toBe(422);
    expect(missingError.details).toEqual({ campo: 'sillonId', motivo: 'INEXISTENTE' });

    const inactive = setup({ chair: { id: CHAIR_2, nombre: 'Sillón ficticio 2', activo: false } });
    const inactiveError = await caught(inactive.service.reschedule(APPOINTMENT_ID, input({ sillonId: CHAIR_2 })));
    expect(inactiveError.details).toEqual({ campo: 'sillonId', motivo: 'INACTIVO' });
    expect(inactive.insertEvents).not.toHaveBeenCalled();
  });

  it('valida el DTO antes de abrir la transacción y sitúa el error en motivo', async () => {
    const fixture = setup();

    const error = await caught(fixture.service.reschedule(APPOINTMENT_ID, input({ motivo: '   ' })));

    expect(error.getStatus()).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual({ campo: 'motivo' });
    expect(fixture.steps).toEqual([]);
  });

  it('rechaza una fecha local inexistente antes de consultar conflictos', async () => {
    const fixture = setup({ evaluacion: evaluation({ estado: 'DATOS_INVALIDOS', inicioUtc: null }) });

    const error = await caught(fixture.service.reschedule(APPOINTMENT_ID, input()));

    expect(error.code).toBe('APPOINTMENT_INVALID_TIME');
    expect(error.getStatus()).toBe(400);
    expect(fixture.steps).not.toContain('conflicts');
    expect(fixture.insertEvents).not.toHaveBeenCalled();
  });

  it('detecta el conflicto antes de evaluar la disponibilidad, aun con override', async () => {
    const fixture = setup({
      evaluacion: evaluation({ estado: 'FUERA_DE_DISPONIBILIDAD', requiereOverrideManual: true }),
      appointments: [
        appointment({
          id: 'b1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6e',
          startsAt: NEW_START,
          careEndsAt: new Date(NEW_START.getTime() + 30 * 60_000),
          blockEndsAt: new Date(NEW_START.getTime() + 40 * 60_000),
        }),
      ],
    });

    const error = await caught(
      fixture.service.reschedule(APPOINTMENT_ID, input({ fueraDisponibilidad: true, motivoExcepcion: 'Ficticio' })),
    );

    expect(error.code).toBe('APPOINTMENT_CONFLICT');
    expect(fixture.steps).not.toContain('chair(tx)');
    expect(fixture.steps).toContain('conflicts');
    expect(fixture.steps).not.toContain('events');
    expect(fixture.committed).toBe(false);
  });

  it('excluye el propio turno de la búsqueda de conflictos', async () => {
    const fixture = setup({ appointments: [appointment()] });

    const response = await fixture.service.reschedule(APPOINTMENT_ID, input());

    expect(response.turno.inicio).toBe(NEW_START.toISOString());
    expect(fixture.committed).toBe(true);
  });

  it('rechaza una excepción bloqueante aunque se confirme el override', async () => {
    const fixture = setup({
      evaluacion: evaluation({
        estado: 'EXCEPCION_BLOQUEANTE',
        tipoExcepcion: 'FERIADO',
        motivoExcepcion: 'Feriado ficticio',
      }),
    });

    const error = await caught(
      fixture.service.reschedule(APPOINTMENT_ID, input({ fueraDisponibilidad: true, motivoExcepcion: 'Ficticio' })),
    );

    expect(error.code).toBe('APPOINTMENT_BLOCKED_BY_EXCEPTION');
    expect(error.details).toEqual({ tipoExcepcion: 'FERIADO', motivoExcepcion: 'Feriado ficticio' });
    expect(fixture.insertEvents).not.toHaveBeenCalled();
  });

  it('exige override y motivo para reprogramar fuera de disponibilidad', async () => {
    const withoutOverride = setup({
      evaluacion: evaluation({ estado: 'FUERA_DE_DISPONIBILIDAD', requiereOverrideManual: true }),
    });
    const first = await caught(withoutOverride.service.reschedule(APPOINTMENT_ID, input()));
    expect(first.code).toBe('APPOINTMENT_OUTSIDE_AVAILABILITY');
    expect(first.details).toMatchObject({ requiereOverrideManual: true });

    const withoutReason = setup({
      evaluacion: evaluation({ estado: 'FUERA_DE_DISPONIBILIDAD', requiereOverrideManual: true }),
    });
    const second = await caught(
      withoutReason.service.reschedule(APPOINTMENT_ID, input({ fueraDisponibilidad: true })),
    );
    // El DTO exige motivoExcepcion cuando se confirma el override: 400 antes que disponibilidad.
    expect(second.code).toBe('VALIDATION_ERROR');
    expect(second.details).toEqual({ campo: 'motivoExcepcion' });
    expect(withoutReason.insertEvents).not.toHaveBeenCalled();
  });

  it('registra CREADO + REPROGRAMADO + EXCEPCION al reprogramar fuera de disponibilidad con justificación', async () => {
    const fixture = setup({
      evaluacion: evaluation({ estado: 'FUERA_DE_DISPONIBILIDAD', requiereOverrideManual: true }),
    });

    const response = await fixture.service.reschedule(
      APPOINTMENT_ID,
      input({ fueraDisponibilidad: true, motivoExcepcion: '  Motivo   ficticio  ' }),
    );

    expect(response.turno).toMatchObject({ fueraDisponibilidad: true, motivoExcepcion: 'Motivo ficticio' });
    expect(fixture.events.map((event) => event.type)).toEqual(['CREADO', 'REPROGRAMADO', 'EXCEPCION']);
    expect(fixture.events.at(-1)).toMatchObject({ reason: 'Motivo ficticio' });
  });

  it('rechaza reprogramar un turno terminal con APPOINTMENT_INVALID_TRANSITION', async () => {
    const fixture = setup({ current: appointment({ status: 'ATENDIDO' }) });

    const error = await caught(fixture.service.reschedule(APPOINTMENT_ID, input()));

    expect(error.code).toBe('APPOINTMENT_INVALID_TRANSITION');
    expect(error.details).toEqual({ estadoActual: 'ATENDIDO', operacion: 'REPROGRAMAR' });
    expect(fixture.steps).toEqual(['lock', 'load']);
  });

  it('revierte turno y eventos si falla la escritura del historial', async () => {
    const failure = new Error('historial no disponible');
    const fixture = setup({ failOnEvents: failure });

    const error = await fixture.service.reschedule(APPOINTMENT_ID, input()).catch((value: unknown) => value);

    expect(error).toBe(failure);
    expect(fixture.committed).toBe(false);
    expect(fixture.current.startsAt).toEqual(START);
    expect(fixture.current.chairId).toBe(CHAIR_1);
    expect(fixture.events.map((event) => event.type)).toEqual(['CREADO']);
  });
});
