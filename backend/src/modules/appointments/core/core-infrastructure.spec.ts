import { jest } from '@jest/globals';
import { FindOperator, type DataSource, type EntityManager } from 'typeorm';
import type { DatabaseConnectionService } from '../../../database/database-connection.service.js';
import { AGENDA_CONFIGURATION_LOCK } from '../../../shared/database/transaction-boundary.js';
import { CONFIGURACION_UNICA_ID } from '../../availability/availability.constants.js';
import { FixedClock, SystemClock } from './clock.js';
import { findBlockingConflicts } from './database/appointment-conflicts.js';
import {
  AgendaLockError,
  TypeOrmTransactionBoundary,
  lockAgendaConfiguration,
} from './database/typeorm-transaction-boundary.js';
import { AppointmentEntity } from './entities/appointment.entity.js';

type QueryFn = (sql: string, parameters?: unknown[]) => Promise<unknown>;

function managerWith(query: jest.Mock<QueryFn>, extra: Record<string, unknown> = {}): EntityManager {
  return { query, ...extra } as unknown as EntityManager;
}

describe('lockAgendaConfiguration', () => {
  it('bloquea la fila única con FOR UPDATE y devuelve el intervalo global leído bajo el lock', async () => {
    const query = jest.fn<QueryFn>().mockResolvedValue([{ intervalo_global_minutos: '15' }]);

    await expect(lockAgendaConfiguration(managerWith(query))).resolves.toEqual({ globalIntervalMinutes: 15 });
    expect(query).toHaveBeenCalledWith(
      'SELECT intervalo_global_minutos FROM configuracion_agenda WHERE id = ? FOR UPDATE',
      [CONFIGURACION_UNICA_ID],
    );
  });

  it('falla explícitamente si la fila no existe, porque el lock no serializaría nada', async () => {
    const query = jest.fn<QueryFn>().mockResolvedValue([]);
    await expect(lockAgendaConfiguration(managerWith(query))).rejects.toBeInstanceOf(AgendaLockError);
  });
});

describe('TypeOrmTransactionBoundary', () => {
  function setup(rows: unknown[] = [{ intervalo_global_minutos: 10 }]) {
    const query = jest.fn<QueryFn>().mockResolvedValue(rows);
    const manager = managerWith(query);
    const transaction = jest.fn(async (work: (manager: EntityManager) => Promise<unknown>) => work(manager));
    const dataSource = { transaction } as unknown as DataSource;
    const ensureInitialized = jest.fn(async () => dataSource);
    const boundary = new TypeOrmTransactionBoundary({ ensureInitialized } as unknown as DatabaseConnectionService);
    return { boundary, query, manager, transaction, ensureInitialized };
  }

  it('ejecuta el trabajo dentro de una transacción con el manager de esa transacción', async () => {
    const { boundary, manager, transaction, ensureInitialized } = setup();

    const result = await boundary.run(async (context) => {
      expect(context.manager).toBe(manager);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(ensureInitialized).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('acquireLock toma el lock de agenda y expone su snapshot', async () => {
    const { boundary, query } = setup([{ intervalo_global_minutos: 25 }]);

    const snapshots = await boundary.run(async (context) => {
      const before = context.lockSnapshot();
      await context.acquireLock(AGENDA_CONFIGURATION_LOCK);
      return { before, after: context.lockSnapshot() };
    });

    expect(snapshots).toEqual({ before: null, after: { globalIntervalMinutes: 25 } });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('propaga el error del trabajo para que TypeORM revierta la transacción', async () => {
    const { boundary } = setup();
    const failure = new Error('event write failed');
    await expect(boundary.run(async () => { throw failure; })).rejects.toBe(failure);
  });
});

describe('findBlockingConflicts', () => {
  it('consulta turnos bloqueantes cuyo período intersecta el candidato, en cualquier sillón', async () => {
    const find = jest.fn(async () => [
      Object.assign(new AppointmentEntity(), {
        id: 'a',
        chairId: 'chair-2',
        status: 'CONFIRMADO',
        startsAt: new Date('2027-03-10T13:00:00Z'),
        blockEndsAt: new Date('2027-03-10T13:40:00Z'),
      }),
    ]);
    const manager = { find } as unknown as EntityManager;
    const period = { startsAt: new Date('2027-03-10T13:15:00Z'), blockEndsAt: new Date('2027-03-10T13:55:00Z') };

    const result = await findBlockingConflicts(manager, period);

    expect(result).toEqual([
      { id: 'a', chairId: 'chair-2', status: 'CONFIRMADO', startsAt: new Date('2027-03-10T13:00:00Z'), blockEndsAt: new Date('2027-03-10T13:40:00Z') },
    ]);
    const [entity, options] = find.mock.calls[0] as unknown as [unknown, { where: Record<string, FindOperator<unknown>> }];
    expect(entity).toBe(AppointmentEntity);
    expect(options.where.status.value).toEqual(['PROGRAMADO', 'CONFIRMADO', 'ATENDIDO', 'AUSENTE']);
    expect(options.where.startsAt.type).toBe('lessThan');
    expect(options.where.startsAt.value).toBe(period.blockEndsAt);
    expect(options.where.blockEndsAt.type).toBe('moreThan');
    expect(options.where.blockEndsAt.value).toBe(period.startsAt);
    expect(options.where).not.toHaveProperty('chairId');
    expect(options.where).not.toHaveProperty('id');
  });

  it('excluye un turno cuando se indica (reprogramación de C-06)', async () => {
    const find = jest.fn(async () => []);
    await findBlockingConflicts({ find } as unknown as EntityManager, { startsAt: new Date(0), blockEndsAt: new Date(1) }, 'propio');
    const [, options] = find.mock.calls[0] as unknown as [unknown, { where: Record<string, FindOperator<unknown>> }];
    expect(options.where.id.type).toBe('not');
    expect(options.where.id.value).toBe('propio');
  });
});

describe('relojes', () => {
  it('FixedClock devuelve copias del instante fijado y puede moverse', () => {
    const clock = new FixedClock(new Date('2027-03-10T12:00:00Z'));
    const first = clock.now();
    first.setUTCHours(0);
    expect(clock.now().toISOString()).toBe('2027-03-10T12:00:00.000Z');
    clock.set(new Date('2027-03-11T08:00:00Z'));
    expect(clock.now().toISOString()).toBe('2027-03-11T08:00:00.000Z');
  });

  it('SystemClock usa la hora actual del servidor', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
