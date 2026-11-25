import { Inject, Injectable } from '@nestjs/common';
import { AGENDA_CONFIGURATION_LOCK } from '../../../shared/database/transaction-boundary.js';
import { APPOINTMENT_CLOCK, type Clock } from '../core/clock.js';
import { AppointmentWriter } from '../core/database/appointment-writer.js';
import { APPOINTMENT_TRANSACTION_BOUNDARY } from '../core/database/typeorm-transaction-boundary.js';
import { AppointmentEntity } from '../core/entities/appointment.entity.js';
import type { AppointmentLifecycleResponse } from './dto/appointment-lifecycle-response.js';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import { validateLifecycleInput } from './dto/lifecycle-input-validation.js';
import { assertTransition } from './domain/appointment-transitions.js';
import { invalidTransition } from './lifecycle-errors.js';
import { buildCancelEvent } from './lifecycle-event.factory.js';
import { lifecycleResponse, loadAppointment, type AppointmentTransactions } from './lifecycle-transaction.js';

/** Cancelación con motivo: la única arista que llega a CANCELADO (RN-TU-14). */
@Injectable()
export class CancelAppointmentService {
  constructor(
    @Inject(APPOINTMENT_TRANSACTION_BOUNDARY) private readonly transactions: AppointmentTransactions,
    @Inject(APPOINTMENT_CLOCK) private readonly clock: Clock,
    private readonly writer: AppointmentWriter,
  ) {}

  async cancel(id: string, input: CancelAppointmentDto): Promise<AppointmentLifecycleResponse> {
    const dto = await validateLifecycleInput(CancelAppointmentDto, input);

    return this.transactions.run(async (tx) => {
      await tx.acquireLock(AGENDA_CONFIGURATION_LOCK);
      const appointment = await loadAppointment(tx, this.writer, id);

      const check = assertTransition(appointment.status, 'CANCELADO');
      if (!check.ok) throw invalidTransition(appointment.status, 'CANCELAR');

      const occurredAt = this.clock.now();
      await tx.manager.update(AppointmentEntity, id, {
        status: 'CANCELADO',
        cancellationReason: dto.motivo,
      });
      await this.writer.insertEvents(
        tx.manager,
        [
          buildCancelEvent({
            appointmentId: id,
            previousStatus: appointment.status,
            reason: dto.motivo,
            occurredAt,
          }),
        ],
      );
      return lifecycleResponse(tx, this.writer, id);
    });
  }
}
