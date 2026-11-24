import { jest } from '@jest/globals';
import { EntityNotFoundError, type EntityManager } from 'typeorm';
import type { AppointmentWriter } from '../core/database/appointment-writer.js';
import type { AppointmentTransactionContext } from '../core/database/typeorm-transaction-boundary.js';
import type { AppointmentEventType } from '../core/domain/appointment-status.js';
import { AppointmentEntity } from '../core/entities/appointment.entity.js';
import { AppointmentEventEntity } from '../core/entities/appointment-event.entity.js';
import { LifecycleError } from '../lifecycle/lifecycle-errors.js';
import type { AppointmentTransactions } from '../lifecycle/lifecycle-transaction.js';
import { GetAppointmentHistoryService } from './get-appointment-history.service.js';

const TURNO_ID = 'c6a00001-0000-4000-8000-000000000001';
const CHAIR_ID = 'c6a00002-0000-4000-8000-000000000002';
const INICIO = new Date('2027-03-10T13:00:00.000Z');

type EventInput = Pick<AppointmentEventEntity, 'id' | 'type' | 'occurredAt'> & Partial<AppointmentEventEntity>;

function event(input: EventInput): AppointmentEventEntity {
  return Object.assign(new AppointmentEventEntity(), {
    appointmentId: TURNO_ID,
    previousStatus: null,
    newStatus: null,
    previousStartsAt: null,
    newStartsAt: null,
    previousChairId: null,
    newChairId: null,
    reason: null,
    ...input,
  });
}

function eventOf(type: AppointmentEventType, id: string, occurredAt: Date): AppointmentEventEntity {
  return event({ id, type, occurredAt });
}

function setup(events: readonly AppointmentEventEntity[], options: { missing?: boolean; failure?: Error } = {}) {
  const find = jest.fn(async (_entity: unknown, _options: { take?: number; skip?: number }) => [...events]);
  const manager = { find } as unknown as EntityManager;
  const findAppointment = jest.fn(async () => {
    if (options.failure) throw options.failure;
    if (options.missing) throw new EntityNotFoundError(AppointmentEntity, { id: TURNO_ID });
    return Object.assign(new AppointmentEntity(), {
      id: TURNO_ID,
      patientId: 'paciente-ficticio-no-debe-publicarse',
      procedureId: 'prestacion-ficticia-no-debe-publicarse',
    });
  });
  const writer = { findAppointment } as unknown as AppointmentWriter;
  const run = jest.fn(
    async <T>(work: (context: AppointmentTransactionContext) => Promise<T>): Promise<T> =>
      work({ manager, acquireLock: async () => undefined, lockSnapshot: () => null }),
  );
  const boundary = { run } as unknown as AppointmentTransactions;
  const service = new GetAppointmentHistoryService(boundary, writer);
  return { service, find, findAppointment, run };
}

const EXPECTED_EVENT_KEYS = [
  'estadoAnterior',
  'estadoNuevo',
  'id',
  'inicioAnterior',
  'inicioNuevo',
  'motivo',
  'ocurridoEn',
  'sillonAnteriorId',
  'sillonNuevoId',
  'tipo',
];

describe('GetAppointmentHistoryService', () => {
  it('proyecta solo los campos de P1-02, con no aplicables en null y sin datos de paciente', async () => {
    const { service } = setup([
      event({
        id: 'c6a00011-0000-4000-8000-000000000011',
        type: 'CREADO',
        occurredAt: new Date('2027-03-01T10:00:00.000Z'),
        newStatus: 'PROGRAMADO',
        newStartsAt: INICIO,
        newChairId: CHAIR_ID,
      }),
      event({
        id: 'c6a00012-0000-4000-8000-000000000012',
        type: 'CAMBIO_ESTADO',
        occurredAt: new Date('2027-03-02T10:00:00.000Z'),
        previousStatus: 'PROGRAMADO',
        newStatus: 'CONFIRMADO',
        reason: 'Motivo interno que no debe publicarse',
      }),
    ]);

    const history = await service.getHistory(TURNO_ID);

    expect(Object.keys(history).sort()).toEqual(['eventos', 'turnoId']);
    expect(history.turnoId).toBe(TURNO_ID);
    expect(history.eventos).toEqual([
      {
        id: 'c6a00011-0000-4000-8000-000000000011',
        tipo: 'CREADO',
        ocurridoEn: '2027-03-01T10:00:00.000Z',
        estadoAnterior: null,
        estadoNuevo: 'PROGRAMADO',
        inicioAnterior: null,
        inicioNuevo: '2027-03-10T13:00:00.000Z',
        sillonAnteriorId: null,
        sillonNuevoId: CHAIR_ID,
        motivo: null,
      },
      {
        id: 'c6a00012-0000-4000-8000-000000000012',
        tipo: 'CAMBIO_ESTADO',
        ocurridoEn: '2027-03-02T10:00:00.000Z',
        estadoAnterior: 'PROGRAMADO',
        estadoNuevo: 'CONFIRMADO',
        inicioAnterior: null,
        inicioNuevo: null,
        sillonAnteriorId: null,
        sillonNuevoId: null,
        motivo: null,
      },
    ]);
    for (const item of history.eventos) {
      expect(Object.keys(item).sort()).toEqual(EXPECTED_EVENT_KEYS);
    }
    const serialized = JSON.stringify(history);
    for (const forbidden of [
      'paciente',
      'prestacion',
      'patientId',
      'procedureId',
      'nombre',
      'telefono',
      'dni',
      'correo',
      'diagnostico',
      'Motivo interno',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('publica motivo solo en REPROGRAMADO, CANCELADO y EXCEPCION, con instantes UTC', async () => {
    const { service } = setup([
      event({
        id: 'c6a00013-0000-4000-8000-000000000013',
        type: 'REPROGRAMADO',
        occurredAt: new Date('2027-03-04T09:00:00.000Z'),
        previousStatus: 'CONFIRMADO',
        newStatus: 'PROGRAMADO',
        previousStartsAt: INICIO,
        newStartsAt: new Date('2027-03-12T09:00:00.000Z'),
        previousChairId: CHAIR_ID,
        newChairId: 'c6a00003-0000-4000-8000-000000000003',
        reason: 'Motivo ficticio de reprogramación',
      }),
      event({
        id: 'c6a00014-0000-4000-8000-000000000014',
        type: 'CANCELADO',
        occurredAt: new Date('2027-03-05T09:00:00.000Z'),
        previousStatus: 'PROGRAMADO',
        newStatus: 'CANCELADO',
        reason: 'Motivo ficticio de cancelación',
      }),
      event({
        id: 'c6a00015-0000-4000-8000-000000000015',
        type: 'EXCEPCION',
        occurredAt: new Date('2027-03-06T09:00:00.000Z'),
        reason: 'Motivo ficticio de excepción',
      }),
      event({
        id: 'c6a00016-0000-4000-8000-000000000016',
        type: 'CREADO',
        occurredAt: new Date('2027-03-01T09:00:00.000Z'),
        newStatus: 'PROGRAMADO',
        reason: 'Motivo interno que no debe publicarse',
      }),
    ]);

    const history = await service.getHistory(TURNO_ID);

    expect(history.eventos.map((item) => item.motivo)).toEqual([
      null,
      'Motivo ficticio de reprogramación',
      'Motivo ficticio de cancelación',
      'Motivo ficticio de excepción',
    ]);
    expect(history.eventos[1]).toMatchObject({
      estadoAnterior: 'CONFIRMADO',
      estadoNuevo: 'PROGRAMADO',
      inicioAnterior: '2027-03-10T13:00:00.000Z',
      inicioNuevo: '2027-03-12T09:00:00.000Z',
      sillonAnteriorId: CHAIR_ID,
      sillonNuevoId: 'c6a00003-0000-4000-8000-000000000003',
    });
    expect(history.eventos.map((item) => item.ocurridoEn)).toEqual([
      '2027-03-01T09:00:00.000Z',
      '2027-03-04T09:00:00.000Z',
      '2027-03-05T09:00:00.000Z',
      '2027-03-06T09:00:00.000Z',
    ]);
    for (const item of history.eventos) {
      expect(Object.keys(item).sort()).toEqual(EXPECTED_EVENT_KEYS);
      expect(item.ocurridoEn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    }
    expect(JSON.stringify(history)).not.toContain('Motivo interno');
  });

  it('ordena por id ante igualdad de instantes', async () => {
    const instante = new Date('2027-03-08T08:00:00.000Z');
    const { service } = setup([
      eventOf('CAMBIO_ESTADO', 'c6a00033-0000-4000-8000-000000000033', instante),
      eventOf('CREADO', 'c6a00031-0000-4000-8000-000000000031', instante),
      eventOf('CANCELADO', 'c6a00032-0000-4000-8000-000000000032', instante),
    ]);

    const history = await service.getHistory(TURNO_ID);

    expect(history.eventos.map((item) => item.id)).toEqual([
      'c6a00031-0000-4000-8000-000000000031',
      'c6a00032-0000-4000-8000-000000000032',
      'c6a00033-0000-4000-8000-000000000033',
    ]);
    expect(history.eventos.map((item) => item.tipo)).toEqual(['CREADO', 'CANCELADO', 'CAMBIO_ESTADO']);
  });

  it('ordena por instante sin paginar aunque haya más de diez eventos', async () => {
    const events = Array.from({ length: 12 }, (_, index) =>
      eventOf('CAMBIO_ESTADO', `c6a01${String(index).padStart(2, '0')}-0000-4000-8000-000000000000`, new Date(Date.UTC(2027, 2, 20 - index, 10))),
    );
    const { service, find } = setup(events);

    const history = await service.getHistory(TURNO_ID);

    expect(history.eventos).toHaveLength(12);
    expect(history.eventos.map((item) => item.id)).toEqual(events.map((item) => item.id).reverse());
    expect(find).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        where: { appointmentId: TURNO_ID },
        order: { occurredAt: 'ASC', id: 'ASC' },
      }),
    );
    const [, options] = find.mock.calls[0];
    expect(options.take).toBeUndefined();
    expect(options.skip).toBeUndefined();
  });

  it('responde 404 con el código neutral cuando el turno no existe', async () => {
    const { service, find } = setup([], { missing: true });

    await expect(service.getHistory(TURNO_ID)).rejects.toBeInstanceOf(LifecycleError);
    await expect(service.getHistory(TURNO_ID)).rejects.toMatchObject({
      code: 'APPOINTMENT_NOT_FOUND',
      message: 'El turno no existe',
    });
    expect(find).not.toHaveBeenCalled();
  });

  it('no disfraza de 404 un error inesperado al cargar el turno', async () => {
    const failure = new Error('fallo inesperado de infraestructura');
    const { service } = setup([], { failure });

    await expect(service.getHistory(TURNO_ID)).rejects.toBe(failure);
  });
});
