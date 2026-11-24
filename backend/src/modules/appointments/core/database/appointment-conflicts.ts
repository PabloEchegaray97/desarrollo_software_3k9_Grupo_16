import { In, LessThan, MoreThan, Not, type EntityManager } from 'typeorm';
import type { BlockedPeriod, ScheduledAppointment } from '../domain/appointment-policy.js';
import { BLOCKING_STATUSES } from '../domain/appointment-status.js';
import { AppointmentEntity } from '../entities/appointment.entity.js';

/**
 * Turnos bloqueantes, en cualquier sillón, cuyo período intersecta `[startsAt, blockEndsAt)`.
 * Debe llamarse con el `EntityManager` de una transacción que ya tomó el lock de agenda;
 * `excludeId` permite a C-06 reprogramar sin chocar con el propio turno.
 */
export async function findBlockingConflicts(
  manager: EntityManager,
  period: Pick<BlockedPeriod, 'startsAt' | 'blockEndsAt'>,
  excludeId?: string,
): Promise<ScheduledAppointment[]> {
  const rows = await manager.find(AppointmentEntity, {
    select: { id: true, chairId: true, status: true, startsAt: true, blockEndsAt: true },
    where: {
      status: In([...BLOCKING_STATUSES]),
      startsAt: LessThan(period.blockEndsAt),
      blockEndsAt: MoreThan(period.startsAt),
      ...(excludeId ? { id: Not(excludeId) } : {}),
    },
    order: { startsAt: 'ASC', id: 'ASC' },
  });
  return rows.map((row) => ({
    id: row.id,
    chairId: row.chairId,
    status: row.status,
    startsAt: row.startsAt,
    blockEndsAt: row.blockEndsAt,
  }));
}
