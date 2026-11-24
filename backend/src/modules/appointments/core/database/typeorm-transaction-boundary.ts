import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { DatabaseConnectionService } from '../../../../database/database-connection.service.js';
import {
  AGENDA_CONFIGURATION_LOCK,
  type TransactionBoundary,
  type TransactionContext,
} from '../../../../shared/database/transaction-boundary.js';
import { CONFIGURACION_UNICA_ID } from '../../../availability/availability.constants.js';

/** Token para inyectar la frontera transaccional (C-05 crea, C-06 reprograma y cambia estado). */
export const APPOINTMENT_TRANSACTION_BOUNDARY = Symbol('APPOINTMENT_TRANSACTION_BOUNDARY');

export interface AgendaLockSnapshot {
  /** Intervalo global leído bajo el lock: coherente con la escritura de la misma transacción. */
  globalIntervalMinutes: number;
}

export class AgendaLockError extends Error {
  constructor() {
    super('Agenda configuration row is missing; the lock cannot serialize writes');
    this.name = 'AgendaLockError';
  }
}

interface ConfigurationRow {
  intervalo_global_minutos: number | string;
}

/**
 * Bloquea la fila única de `configuracion_agenda` con `SELECT … FOR UPDATE` (C-01 §5).
 * Toda escritura que compite por la agenda toma este lock antes de leer conflictos,
 * así InnoDB serializa las altas y la lectura posterior ve todo turno ya confirmado.
 */
export async function lockAgendaConfiguration(manager: EntityManager): Promise<AgendaLockSnapshot> {
  const rows = (await manager.query(
    'SELECT intervalo_global_minutos FROM configuracion_agenda WHERE id = ? FOR UPDATE',
    [CONFIGURACION_UNICA_ID],
  )) as ConfigurationRow[];
  const [row] = rows;
  if (!row) throw new AgendaLockError();
  return { globalIntervalMinutes: Number(row.intervalo_global_minutos) };
}

export interface AppointmentTransactionContext extends TransactionContext {
  /** Snapshot del último `acquireLock`; `null` si todavía no se tomó. */
  readonly lockSnapshot: () => AgendaLockSnapshot | null;
}

/** Implementación TypeORM de la frontera transaccional compartida definida por C-01. */
@Injectable()
export class TypeOrmTransactionBoundary implements TransactionBoundary {
  constructor(private readonly database: DatabaseConnectionService) {}

  async run<T>(work: (context: AppointmentTransactionContext) => Promise<T>): Promise<T> {
    const dataSource = await this.database.ensureInitialized();
    return dataSource.transaction(async (manager) => {
      let snapshot: AgendaLockSnapshot | null = null;
      const context: AppointmentTransactionContext = {
        manager,
        acquireLock: async (target: typeof AGENDA_CONFIGURATION_LOCK) => {
          if (target !== AGENDA_CONFIGURATION_LOCK) throw new Error(`Unknown lock target: ${String(target)}`);
          snapshot = await lockAgendaConfiguration(manager);
        },
        lockSnapshot: () => snapshot,
      };
      return work(context);
    });
  }
}
