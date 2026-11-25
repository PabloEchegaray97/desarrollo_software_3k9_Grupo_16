import { Inject, Injectable } from '@nestjs/common';
import { AGENDA_CONFIGURATION_LOCK } from '../../../shared/database/transaction-boundary.js';
import { APPOINTMENT_CLOCK, type Clock } from '../core/clock.js';
import { AppointmentWriter } from '../core/database/appointment-writer.js';
import { APPOINTMENT_TRANSACTION_BOUNDARY } from '../core/database/typeorm-transaction-boundary.js';
import { AppointmentEntity } from '../core/entities/appointment.entity.js';
import type { AppointmentLifecycleResponse } from './dto/appointment-lifecycle-response.js';
import { ChangeAppointmentStatusDto } from './dto/change-appointment-status.dto.js';
import { validateLifecycleInput } from './dto/lifecycle-input-validation.js';
import { assertTransition, isStatusObserved } from './domain/appointment-transitions.js';
import { invalidTransition, tooEarly } from './lifecycle-errors.js';
import { buildStatusChangeEvent } from './lifecycle-event.factory.js';
import { lifecycleResponse, loadAppointment, type AppointmentTransactions } from './lifecycle-transaction.js';

/** Confirmar/atender/marcar ausencia: `CANCELADO` no llega por esta ruta (design § 5). */
@Injectable()
export class ChangeAppointmentStatusService {
  constructor(
    @Inject(APPOINTMENT_TRANSACTION_BOUNDARY) private readonly transactions: AppointmentTransactions,
    @Inject(APPOINTMENT_CLOCK) private readonly clock: Clock,
    private readonly writer: AppointmentWriter,
  ) {}

  async changeStatus(id: string, input: ChangeAppointmentStatusDto): Promise<AppointmentLifecycleResponse> {
    const dto = await validateLifecycleInput(ChangeAppointmentStatusDto, input);

    return this.transactions.run(async (tx) => {
      await tx.acquireLock(AGENDA_CONFIGURATION_LOCK);
      const appointment = await loadAppointment(tx, this.writer, id);

      const check = assertTransition(appointment.status, dto.estado);
      if (!check.ok) throw invalidTransition(appointment.status, 'CAMBIAR_ESTADO');

      const now = this.clock.now();
      const requiresWindow = dto.estado === 'ATENDIDO' || dto.estado === 'AUSENTE';
      if (requiresWindow && !isStatusObserved(now, appointment.startsAt)) {
        throw tooEarly(appointment.startsAt, now);
      }

      await tx.manager.update(AppointmentEntity, id, { status: dto.estado });
      await this.writer.insertEvents(
        tx.manager,
        [
          buildStatusChangeEvent({
            appointmentId: id,
            previousStatus: appointment.status,
            newStatus: dto.estado,
            occurredAt: now,
          }),
        ],
      );
      return lifecycleResponse(tx, this.writer, id);
    });
  }
}
