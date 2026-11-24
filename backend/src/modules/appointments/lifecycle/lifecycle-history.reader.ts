import type { EntityManager } from 'typeorm';
import type { AppointmentEventType } from '../core/domain/appointment-status.js';
import { AppointmentEventEntity } from '../core/entities/appointment-event.entity.js';
import type { LifecycleEventResponse } from './dto/appointment-lifecycle-response.js';

/** P1-02: solo estas tres clases de evento pueden exponer un motivo. */
const REASON_TYPES: readonly AppointmentEventType[] = ['CANCELADO', 'REPROGRAMADO', 'EXCEPCION'];

/** Proyección autorizada: sin nombres, datos de pacientes ni campos derivados. */
export function toLifecycleHistory(events: readonly AppointmentEventEntity[]): LifecycleEventResponse[] {
  return [...events]
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id))
    .map((event) => ({
      id: event.id,
      tipo: event.type,
      ocurridoEn: event.occurredAt.toISOString(),
      estadoAnterior: event.previousStatus,
      estadoNuevo: event.newStatus,
      inicioAnterior: event.previousStartsAt?.toISOString() ?? null,
      inicioNuevo: event.newStartsAt?.toISOString() ?? null,
      sillonAnteriorId: event.previousChairId,
      sillonNuevoId: event.newChairId,
      motivo: REASON_TYPES.includes(event.type) ? event.reason : null,
    }));
}

/** Historial leído con el manager de la transacción que acaba de mutar el turno. */
export async function readLifecycleHistory(
  manager: EntityManager,
  appointmentId: string,
): Promise<LifecycleEventResponse[]> {
  const events = await manager.find(AppointmentEventEntity, {
    where: { appointmentId },
    order: { occurredAt: 'ASC', id: 'ASC' },
  });
  return toLifecycleHistory(events);
}
