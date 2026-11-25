import { Inject, Injectable } from '@nestjs/common';
import { AGENDA_CONFIGURATION_LOCK } from '../../../shared/database/transaction-boundary.js';
import { AVAILABILITY_EVALUATION_PORT, type AvailabilityEvaluationPort } from '../../availability/availability.port.js';
import { CatalogReferences } from '../../catalogs/catalog-references.js';
import { APPOINTMENT_CLOCK, type Clock } from '../core/clock.js';
import { findBlockingConflicts } from '../core/database/appointment-conflicts.js';
import { AppointmentWriter } from '../core/database/appointment-writer.js';
import { APPOINTMENT_TRANSACTION_BOUNDARY } from '../core/database/typeorm-transaction-boundary.js';
import { blockedPeriod, classifyConflicts } from '../core/domain/appointment-policy.js';
import { AppointmentEntity } from '../core/entities/appointment.entity.js';
import type { AppointmentLifecycleResponse } from './dto/appointment-lifecycle-response.js';
import { validateLifecycleInput } from './dto/lifecycle-input-validation.js';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto.js';
import { assertReschedulable } from './domain/appointment-transitions.js';
import {
  blockedByException,
  outsideAvailability,
  invalidTime,
  invalidTransition,
  referenceInvalid,
  scheduleConflict,
} from './lifecycle-errors.js';
import { buildRescheduleEvents } from './lifecycle-event.factory.js';
import { lifecycleResponse, loadAppointment, type AppointmentTransactions } from './lifecycle-transaction.js';

export type { AppointmentTransactions } from './lifecycle-transaction.js';

/** Reprogramación atómica: los once pasos aprobados en `design.md` § Algoritmo de reprogramación. */
@Injectable()
export class RescheduleAppointmentService {
  constructor(
    @Inject(APPOINTMENT_TRANSACTION_BOUNDARY) private readonly transactions: AppointmentTransactions,
    @Inject(APPOINTMENT_CLOCK) private readonly clock: Clock,
    @Inject(AVAILABILITY_EVALUATION_PORT) private readonly availability: AvailabilityEvaluationPort,
    private readonly catalogs: CatalogReferences,
    private readonly writer: AppointmentWriter,
  ) {}

  async reschedule(id: string, input: RescheduleAppointmentDto): Promise<AppointmentLifecycleResponse> {
    // 1. Validación fuera de la transacción; el pipe HTTP y el servicio coinciden.
    const dto = await validateLifecycleInput(RescheduleAppointmentDto, input);

    return this.transactions.run(async (tx) => {
      // 2. Serializa la agenda antes de leer cualquier turno.
      await tx.acquireLock(AGENDA_CONFIGURATION_LOCK);

      // 3. El turno se lee bajo el lock.
      const appointment = await loadAppointment(tx, this.writer, id);

      // 4. Un estado terminal no se reprograma.
      const check = assertReschedulable(appointment.status);
      if (!check.ok) throw invalidTransition(appointment.status, 'REPROGRAMAR');

      // 5. Minutos efectivos ya persistidos: la reprogramación no los recalcula desde la prestación.
      const times = {
        durationMinutes: appointment.durationMinutes,
        postIntervalMinutes: appointment.postIntervalMinutes,
      };
      const evaluation = await this.availability.evaluar({
        fecha: dto.fecha,
        horaInicio: dto.horaInicio,
        duracionMinutos: times.durationMinutes,
        intervaloPosteriorMinutos: times.postIntervalMinutes,
      });
      if (evaluation.estado === 'DATOS_INVALIDOS' || evaluation.inicioUtc === null) throw invalidTime();

      // 6. Fines derivados del nuevo inicio, sin duplicarlos en el evento.
      const period = blockedPeriod(new Date(evaluation.inicioUtc), times);

      // 7. Conflicto primero: un override nunca lo exceptúa (RN-DI-06).
      const chairId = dto.sillonId ?? appointment.chairId;
      const conflicts = classifyConflicts(
        period,
        chairId,
        await findBlockingConflicts(tx.manager, period, id),
        id,
      );
      if (conflicts) throw scheduleConflict(conflicts);

      // 8. Disponibilidad: solo FUERA_DE_DISPONIBILIDAD admite override justificado.
      if (evaluation.estado === 'EXCEPCION_BLOQUEANTE') {
        throw blockedByException(evaluation.tipoExcepcion, evaluation.motivoExcepcion);
      }
      const outside = evaluation.estado === 'FUERA_DE_DISPONIBILIDAD';
      if (outside && dto.fueraDisponibilidad !== true) throw outsideAvailability(period);
      const exceptionReason = outside ? (dto.motivoExcepcion ?? null) : null;
      if (outside && !exceptionReason) throw outsideAvailability(period);

      // 9. El sillón nuevo existe y está activo, leído con el manager de la transacción.
      if (dto.sillonId) {
        const chair = await this.catalogs.findChairById(dto.sillonId, tx.manager);
        if (!chair) throw referenceInvalid('sillonId', 'INEXISTENTE');
        if (!chair.activo) throw referenceInvalid('sillonId', 'INACTIVO');
      }

      // 10. Turno y evento(s) en el mismo commit; CONFIRMADO vuelve a PROGRAMADO (RN-TU-18).
      await tx.manager.update(AppointmentEntity, id, {
        startsAt: period.startsAt,
        careEndsAt: period.careEndsAt,
        blockEndsAt: period.blockEndsAt,
        chairId,
        status: 'PROGRAMADO',
        outsideAvailability: outside,
        exceptionReason,
      });
      await this.writer.insertEvents(
        tx.manager,
        buildRescheduleEvents({
          appointmentId: id,
          previousStatus: appointment.status,
          previousStartsAt: appointment.startsAt,
          newStartsAt: period.startsAt,
          previousChairId: appointment.chairId,
          newChairId: chairId,
          reason: dto.motivo,
          occurredAt: this.clock.now(),
          exceptionReason,
        }),
      );

      // 11. Commit de la frontera y respuesta con historial actualizado.
      return lifecycleResponse(tx, this.writer, id);
    });
  }
}
