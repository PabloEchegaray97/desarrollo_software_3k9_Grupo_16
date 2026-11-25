import { EntityNotFoundError } from 'typeorm';
import type { AppointmentWriter } from '../core/database/appointment-writer.js';
import type { AppointmentTransactionContext } from '../core/database/typeorm-transaction-boundary.js';
import type { AppointmentEntity } from '../core/entities/appointment.entity.js';
import type { AppointmentLifecycleResponse } from './dto/appointment-lifecycle-response.js';

/** Contrato mínimo de la frontera transaccional compartida con C-05. */
export interface AppointmentTransactions {
  run<T>(work: (context: AppointmentTransactionContext) => Promise<T>): Promise<T>;
}

import { toLifecycleAppointmentResponse } from './lifecycle-appointment.mapper.js';
import { appointmentNotFound } from './lifecycle-errors.js';
import { readLifecycleHistory } from './lifecycle-history.reader.js';

/** Carga bajo el lock; el rellamado de C-05 se traduce al código neutral de C-06. */
export async function loadAppointment(
  tx: AppointmentTransactionContext,
  writer: AppointmentWriter,
  id: string,
): Promise<AppointmentEntity> {
  try {
    return await writer.findAppointment(tx.manager, id);
  } catch (error: unknown) {
    if (error instanceof EntityNotFoundError) throw appointmentNotFound();
    throw error;
  }
}

/** Turno actualizado e historial ordenado, ambos leídos dentro de la misma transacción. */
export async function lifecycleResponse(
  tx: AppointmentTransactionContext,
  writer: AppointmentWriter,
  id: string,
): Promise<AppointmentLifecycleResponse> {
  const appointment = await writer.findAppointment(tx.manager, id);
  const history = await readLifecycleHistory(tx.manager, id);
  return { turno: toLifecycleAppointmentResponse(appointment), historial: history };
}
