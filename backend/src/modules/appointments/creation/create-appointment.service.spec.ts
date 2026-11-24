import { jest } from '@jest/globals';
import { HttpStatus } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ResultadoEvaluacion } from '../../availability/domain/availability-policy.js';
import type { AvailabilityEvaluationPort, SolicitudEvaluacionPort } from '../../availability/availability.port.js';
import type { CatalogReferences, ChairReference, ProcedureReference } from '../../catalogs/catalog-references.js';
import type { PatientReference, PatientReferences } from '../../patients/patient-references.js';
import { FixedClock } from '../core/clock.js';
import type { AppointmentWriter, NewAppointment, NewAppointmentEvent } from '../core/database/appointment-writer.js';
import type { AppointmentTransactionContext } from '../core/database/typeorm-transaction-boundary.js';
import type { AppointmentStatus } from '../core/domain/appointment-status.js';
import { AppointmentEntity } from '../core/entities/appointment.entity.js';
import { AppointmentError } from './appointment-errors.js';
import { CreateAppointmentService, type AppointmentTransactions } from './create-appointment.service.js';
import type { CreateAppointmentDto } from './dto/create-appointment.dto.js';

const PATIENT_ID = '3d2a0c74-9f20-4da0-9f5c-4b3e7a8c9d02';
const PROCEDURE_ID = '1b0f8a52-7d0e-4b8e-9d3a-2f1c5e6a7b80';
const CHAIR_1 = '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91';
const CHAIR_2 = '5f4c2e96-b142-4fc2-b17e-6d5a9cafbe24';
const NOW = new Date('2027-03-01T12:00:00.000Z');

interface ExistingRow {
  id: string;
  chairId: string;
  status: AppointmentStatus;
  startsAt: Date;
  blockEndsAt: Date;
}

function evaluation(overrides: Partial<ResultadoEvaluacion> = {}): ResultadoEvaluacion {
  return {
    estado: 'DISPONIBLE',
    requiereOverrideManual: false,
    motivoExcepcion: null,
    tipoExcepcion: null,
    inicioUtc: '2027-03-10T13:00:00.000Z',
    finAtencionUtc: '2027-03-10T13:30:00.000Z',
    finBloqueoUtc: '2027-03-10T13:40:00.000Z',
    ...overrides,
  };
}

function setup(options: {
  patient?: PatientReference | null;
  procedure?: ProcedureReference | null;
  chair?: ChairReference | null;
  globalInterval?: number;
  evaluation?: ResultadoEvaluacion;
  existing?: ExistingRow[];
} = {}) {
  const steps: string[] = [];
  const inserted: { appointment?: NewAppointment; events: NewAppointmentEvent[] } = { events: [] };
  const manager = {
    find: jest.fn(async () => {
      steps.push('conflicts');
      return options.existing ?? [];
    }),
  } as unknown as EntityManager;

  const transactions: AppointmentTransactions = {
    run: async <T>(work: (context: AppointmentTransactionContext) => Promise<T>): Promise<T> => {
      let locked = false;
      return work({
        manager,
        acquireLock: async () => {
          steps.push('lock');
          locked = true;
        },
        lockSnapshot: () => (locked ? { globalIntervalMinutes: options.globalInterval ?? 10 } : null),
      });
    },
  };

  const evaluar = jest.fn(async (request: SolicitudEvaluacionPort) => {
    steps.push('evaluate');
    void request;
    return options.evaluation ?? evaluation();
  });
  const availability: AvailabilityEvaluationPort = { evaluar };

  const patients = {
    findById: jest.fn(async (_id: string, usedManager?: EntityManager) => {
      steps.push(usedManager === manager ? 'patient(tx)' : 'patient(no-tx)');
      return options.patient === undefined ? { id: PATIENT_ID, nombre: 'Paciente Ficticio 1', activo: true } : options.patient;
    }),
  } as unknown as PatientReferences;

  const catalogs = {
    findProcedureById: jest.fn(async () =>
      options.procedure === undefined
        ? { id: PROCEDURE_ID, nombre: 'Control ficticio', activo: true, duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: null }
        : options.procedure,
    ),
    findChairById: jest.fn(async () =>
      options.chair === undefined ? { id: CHAIR_1, nombre: 'Sillón 1', activo: true } : options.chair,
    ),
  } as unknown as CatalogReferences;

  const insertAppointment = jest.fn(async (_manager: EntityManager, appointment: NewAppointment) => {
    steps.push('insert');
    inserted.appointment = appointment;
  });
  const insertEvents = jest.fn(async (_manager: EntityManager, events: readonly NewAppointmentEvent[]) => {
    inserted.events.push(...events);
  });
  const findAppointment = jest.fn(async () =>
    Object.assign(new AppointmentEntity(), { ...inserted.appointment, createdAt: NOW, updatedAt: NOW }),
  );
  const writer = { insertAppointment, insertEvents, findAppointment } as unknown as AppointmentWriter;

  const service = new CreateAppointmentService(transactions, new FixedClock(NOW), availability, patients, catalogs, writer);
  return { service, steps, inserted, evaluar, insertAppointment, insertEvents };
}

const input = (overrides: Partial<CreateAppointmentDto> = {}): CreateAppointmentDto =>
  Object.assign(new (class {})() as CreateAppointmentDto, {
    pacienteId: PATIENT_ID,
    prestacionId: PROCEDURE_ID,
    sillonId: CHAIR_1,
    fecha: '2027-03-10',
    horaInicio: '10:00',
    ...overrides,
  });

async function caught(promise: Promise<unknown>): Promise<AppointmentError> {
  const error: unknown = await promise.catch((value: unknown) => value);
  expect(error).toBeInstanceOf(AppointmentError);
  return error as AppointmentError;
}

describe('CreateAppointmentService — alta ordinaria', () => {
  it('toma el lock antes de leer referencias y conflictos, y las lee con el manager de la transacción', async () => {
    const { service, steps } = setup();
    await service.create(input());
    expect(steps).toEqual(['lock', 'patient(tx)', 'evaluate', 'conflicts', 'insert']);
  });

  it('usa el intervalo global leído bajo el lock y persiste los tiempos efectivos', async () => {
    const { service, inserted, evaluar } = setup({ globalInterval: 10 });

    const response = await service.create(input());

    expect(evaluar).toHaveBeenCalledWith({ fecha: '2027-03-10', horaInicio: '10:00', duracionMinutos: 30, intervaloPosteriorMinutos: 10 });
    expect(inserted.appointment).toMatchObject({
      status: 'PROGRAMADO',
      durationMinutes: 30,
      postIntervalMinutes: 10,
      startsAt: new Date('2027-03-10T13:00:00.000Z'),
      careEndsAt: new Date('2027-03-10T13:30:00.000Z'),
      blockEndsAt: new Date('2027-03-10T13:40:00.000Z'),
      outsideAvailability: false,
      exceptionReason: null,
    });
    expect(response).toMatchObject({ estado: 'PROGRAMADO', inicio: '2027-03-10T13:00:00.000Z', finBloqueo: '2027-03-10T13:40:00.000Z', fueraDisponibilidad: false });
  });

  it('aplica la precedencia turno → prestación → global', async () => {
    const withOwnInterval = setup({
      procedure: { id: PROCEDURE_ID, nombre: 'Control ficticio', activo: true, duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: 5 },
    });
    await withOwnInterval.service.create(input());
    expect(withOwnInterval.inserted.appointment).toMatchObject({ durationMinutes: 30, postIntervalMinutes: 5 });

    const overridden = setup();
    await overridden.service.create(input({ duracionMinutos: 50, intervaloPosteriorMinutos: 0 }));
    expect(overridden.inserted.appointment).toMatchObject({ durationMinutes: 50, postIntervalMinutes: 0 });
  });

  it('registra un único evento CREADO con el reloj del servidor', async () => {
    const { service, inserted } = setup();
    const response = await service.create(input());
    expect(inserted.events).toEqual([
      expect.objectContaining({
        appointmentId: response.id,
        type: 'CREADO',
        occurredAt: NOW,
        previousStatus: null,
        newStatus: 'PROGRAMADO',
        newStartsAt: new Date('2027-03-10T13:00:00.000Z'),
        newChairId: CHAIR_1,
        reason: null,
      }),
    ]);
  });
});

describe('CreateAppointmentService — rechazos', () => {
  it.each([
    ['patient', null, 'pacienteId', 'INEXISTENTE'],
    ['patient', { id: PATIENT_ID, nombre: 'Paciente Ficticio 1', activo: false }, 'pacienteId', 'INACTIVO'],
    ['procedure', null, 'prestacionId', 'INEXISTENTE'],
    ['procedure', { id: PROCEDURE_ID, nombre: 'Control ficticio', activo: false, duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: null }, 'prestacionId', 'INACTIVO'],
    ['chair', null, 'sillonId', 'INEXISTENTE'],
    ['chair', { id: CHAIR_1, nombre: 'Sillón 1', activo: false }, 'sillonId', 'INACTIVO'],
  ] as const)('referencia %s %p → %s %s', async (key, value, campo, motivo) => {
    const { service, insertAppointment } = setup({ [key]: value });
    const error = await caught(service.create(input()));
    expect(error.code).toBe('APPOINTMENT_REFERENCE_INVALID');
    expect(error.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(error.details).toEqual({ campo, motivo });
    expect(error.message).not.toMatch(/\/a/);
    expect(insertAppointment).not.toHaveBeenCalled();
  });

  it('hora local inexistente → APPOINTMENT_INVALID_TIME', async () => {
    const { service } = setup({ evaluation: evaluation({ estado: 'DATOS_INVALIDOS', inicioUtc: null, finAtencionUtc: null, finBloqueoUtc: null }) });
    const error = await caught(service.create(input({ fecha: '2027-02-30' })));
    expect(error.code).toBe('APPOINTMENT_INVALID_TIME');
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('inicio anterior al reloj → APPOINTMENT_IN_PAST', async () => {
    const { service } = setup({ evaluation: evaluation({ inicioUtc: '2027-03-01T11:59:00.000Z' }) });
    const error = await caught(service.create(input({ fecha: '2027-03-01', horaInicio: '08:59' })));
    expect(error.code).toBe('APPOINTMENT_IN_PAST');
  });

  it('inicio exactamente igual al reloj se acepta', async () => {
    const { service } = setup({ evaluation: evaluation({ inicioUtc: NOW.toISOString() }) });
    await expect(service.create(input())).resolves.toMatchObject({ inicio: NOW.toISOString() });
  });

  it('conflicto en otro sillón → APPOINTMENT_CONFLICT alcance ODONTOLOGO sin datos del paciente', async () => {
    const { service, insertAppointment } = setup({
      existing: [{ id: 'a', chairId: CHAIR_2, status: 'PROGRAMADO', startsAt: new Date('2027-03-10T12:45:00Z'), blockEndsAt: new Date('2027-03-10T13:15:00Z') }],
    });
    const error = await caught(service.create(input()));
    expect(error.code).toBe('APPOINTMENT_CONFLICT');
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.details).toEqual({
      alcance: 'ODONTOLOGO',
      conflictos: [{ turnoId: 'a', sillonId: CHAIR_2, inicio: '2027-03-10T12:45:00.000Z', finBloqueo: '2027-03-10T13:15:00.000Z' }],
    });
    expect(insertAppointment).not.toHaveBeenCalled();
  });

  it('un turno CANCELADO devuelto por la base no bloquea', async () => {
    const { service } = setup({
      existing: [{ id: 'c', chairId: CHAIR_1, status: 'CANCELADO', startsAt: new Date('2027-03-10T13:00:00Z'), blockEndsAt: new Date('2027-03-10T13:40:00Z') }],
    });
    await expect(service.create(input())).resolves.toMatchObject({ estado: 'PROGRAMADO' });
  });
});

describe('CreateAppointmentService — disponibilidad y excepción', () => {
  const outside = evaluation({ estado: 'FUERA_DE_DISPONIBILIDAD', requiereOverrideManual: true });

  it('fuera de horario sin confirmación → APPOINTMENT_OUTSIDE_AVAILABILITY y no guarda', async () => {
    const { service, insertAppointment } = setup({ evaluation: outside });
    const error = await caught(service.create(input()));
    expect(error.code).toBe('APPOINTMENT_OUTSIDE_AVAILABILITY');
    expect(error.details).toEqual({ requiereOverrideManual: true, inicio: '2027-03-10T13:00:00.000Z', finAtencion: '2027-03-10T13:30:00.000Z' });
    expect(insertAppointment).not.toHaveBeenCalled();
  });

  it('fuera de horario con motivo → turno de excepción y eventos CREADO + EXCEPCION', async () => {
    const { service, inserted } = setup({ evaluation: outside });
    const response = await service.create(input({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' }));
    expect(response).toMatchObject({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' });
    expect(inserted.events.map((event) => [event.type, event.reason])).toEqual([
      ['CREADO', null],
      ['EXCEPCION', 'Urgencia ficticia'],
    ]);
  });

  it('el conflicto se informa antes que la disponibilidad: el override no lo exceptúa', async () => {
    const { service } = setup({
      evaluation: outside,
      existing: [{ id: 'a', chairId: CHAIR_1, status: 'PROGRAMADO', startsAt: new Date('2027-03-10T13:10:00Z'), blockEndsAt: new Date('2027-03-10T13:50:00Z') }],
    });
    expect((await caught(service.create(input()))).code).toBe('APPOINTMENT_CONFLICT');
    expect((await caught(service.create(input({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' })))).code).toBe('APPOINTMENT_CONFLICT');
  });

  it('día bloqueado por excepción → APPOINTMENT_BLOCKED_BY_EXCEPTION aun con override', async () => {
    const { service, insertAppointment } = setup({
      evaluation: evaluation({ estado: 'EXCEPCION_BLOQUEANTE', tipoExcepcion: 'FERIADO', motivoExcepcion: 'Feriado ficticio' }),
    });
    for (const request of [input(), input({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' })]) {
      const error = await caught(service.create(request));
      expect(error.code).toBe('APPOINTMENT_BLOCKED_BY_EXCEPTION');
      expect(error.details).toEqual({ tipoExcepcion: 'FERIADO', motivoExcepcion: 'Feriado ficticio' });
    }
    expect(insertAppointment).not.toHaveBeenCalled();
  });

  it('override innecesario en un horario disponible → turno ordinario sin motivo ni evento EXCEPCION', async () => {
    const { service, inserted } = setup();
    const response = await service.create(input({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' }));
    expect(response).toMatchObject({ fueraDisponibilidad: false, motivoExcepcion: null });
    expect(inserted.events.map((event) => event.type)).toEqual(['CREADO']);
  });

  it('propaga un fallo del historial para que la transacción se revierta', async () => {
    const { service, insertEvents } = setup();
    const failure = new Error('event write failed');
    insertEvents.mockRejectedValueOnce(failure);
    await expect(service.create(input())).rejects.toBe(failure);
  });
});
