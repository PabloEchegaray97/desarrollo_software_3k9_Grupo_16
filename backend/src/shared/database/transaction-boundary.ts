import type { EntityManager } from 'typeorm';

export const AGENDA_CONFIGURATION_LOCK = 'AGENDA_CONFIGURATION' as const;

export interface TransactionContext {
  readonly manager: EntityManager;
  acquireLock(target: typeof AGENDA_CONFIGURATION_LOCK): Promise<void>;
}

export interface TransactionBoundary {
  run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}
