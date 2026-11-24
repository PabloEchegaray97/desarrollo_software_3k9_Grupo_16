import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { AGENDA_CONFIGURATION_LOCK } from '../../../shared/database/transaction-boundary.js';
import { AVAILABILITY_EVALUATION_PORT, type AvailabilityEvaluationPort } from '../../availability/availability.port.js';
import { CatalogReferences } from '../../catalogs/catalog-references.js';
import { PatientReferences } from '../../patients/patient-references.js';
import { APPOINTMENT_CLOCK, type Clock } from '../core/clock.js';
import { findBlockingConflicts } from '../core/database/appointment-conflicts.js';
import { AppointmentWriter, type NewAppointmentEvent } from '../core/database/appointment-writer.js';
import {
  APPOINTMENT_TRANSACTION_BOUNDARY,
  type AppointmentTransactionContext,
} from '../core/database/typeorm-transaction-boundary.js';
import { blockedPeriod, classifyConflicts, resolveEffectiveTimes } from '../core/domain/appointment-policy.js';
import type { AppointmentEntity } from '../core/entities/appointment.entity.js';
import {
  blockedByException,
  invalidTime,
  outsideAvailability,
  referenceInvalid,
  scheduleConflict,
  startsInPast,
} from './appointment-errors.js';
import type { AppointmentResponse, CreateAppointmentDto } from './dto/create-appointment.dto.js';

/** Contrato mínimo de la frontera transaccional que usa la creación. */
export interface AppointmentTransactions {
  run<T>(work: (context: AppointmentTransactionContext) => Promise<T>): Promise<T>;
}

export function toAppointmentResponse(entity: AppointmentEntity): AppointmentResponse {
  return {
    id: entity.id,
    pacienteId: entity.patientId,
    prestacionId: entity.procedureId,
    sillonId: entity.chairId,
    estado: entity.status,
    inicio: entity.startsAt.toISOString(),
    finAtencion: entity.careEndsAt.toISOString(),
    finBloqueo: entity.blockEndsAt.toISOString(),
    duracionMinutos: entity.durationMinutes,
    intervaloPosteriorMinutos: entity.postIntervalMinutes,
    fueraDisponibilidad: entity.outsideAvailability,
    motivoExcepcion: entity.exceptionReason,
    createdAt: entity.createdAt.toISOString(),
  };
}

/**
 * Alta de turno (US-030/031). Todo ocurre dentro de una transacción que primero toma el lock
 * de agenda, de modo que dos altas incompatibles concurrentes no pueden completarse ambas.
 */
@Injectable()
export class CreateAppointmentService {
  constructor(
    @Inject(APPOINTMENT_TRANSACTION_BOUNDARY) private readonly transactions: AppointmentTransactions,
    @Inject(APPOINTMENT_CLOCK) private readonly clock: Clock,
    @Inject(AVAILABILITY_EVALUATION_PORT) private readonly availability: AvailabilityEvaluationPort,
    private readonly patients: PatientReferences,
    private readonly catalogs: CatalogReferences,
    private readonly writer: AppointmentWriter,
  ) {}

  async create(input: CreateAppointmentDto): Promise<AppointmentResponse> {
    return this.transactions.run(async (tx) => {
      // 1. Serializa la agenda y lee el intervalo global bajo el mismo lock.
      await tx.acquireLock(AGENDA_CONFIGURATION_LOCK);
      const lock = tx.lockSnapshot();
      if (!lock) throw new Error('Agenda lock was not acquired');

      // 2. Referencias activas, leídas con el manager de la transacción.
      const { procedure, chair } = await this.activeReferences(input, tx.manager);

      // 3. Tiempos efectivos (RN-PR-05/06).
      const times = resolveEffectiveTimes({
        overrideDurationMinutes: input.duracionMinutos,
        overrideIntervalMinutes: input.intervaloPosteriorMinutos,
        procedureDurationMinutes: procedure.duracionPredeterminadaMinutos,
        procedureIntervalMinutes: procedure.intervaloPosteriorMinutos,
        globalIntervalMinutes: lock.globalIntervalMinutes,
      });

      // 4. Disponibilidad e instantes UTC desde la zona IANA (C-03).
      const evaluation = await this.availability.evaluar({
        fecha: input.fecha,
        horaInicio: input.horaInicio,
        duracionMinutos: times.durationMinutes,
        intervaloPosteriorMinutos: times.postIntervalMinutes,
      });
      if (evaluation.estado === 'DATOS_INVALIDOS' || evaluation.inicioUtc === null) throw invalidTime();
      const period = blockedPeriod(new Date(evaluation.inicioUtc), times);

      // 5. Inicio no pasado, según el reloj del servidor.
      if (period.startsAt.getTime() < this.clock.now().getTime()) throw startsInPast();

      // 6. Conflictos antes que disponibilidad: el override nunca los exceptúa (RN-DI-06).
      const conflicts = classifyConflicts(period, chair.id, await findBlockingConflicts(tx.manager, period));
      if (conflicts) throw scheduleConflict(conflicts);

      // 7. Disponibilidad: solo FUERA_DE_DISPONIBILIDAD admite override justificado.
      if (evaluation.estado === 'EXCEPCION_BLOQUEANTE') {
        throw blockedByException(evaluation.tipoExcepcion, evaluation.motivoExcepcion);
      }
      const outside = evaluation.estado === 'FUERA_DE_DISPONIBILIDAD';
      if (outside && input.fueraDisponibilidad !== true) throw outsideAvailability(period);
      const exceptionReason = outside ? (input.motivoExcepcion ?? null) : null;
      if (outside && !exceptionReason) throw outsideAvailability(period);

      // 8. Turno + historial en la misma transacción.
      const id = randomUUID();
      const occurredAt = this.clock.now();
      await this.writer.insertAppointment(tx.manager, {
        id,
        patientId: input.pacienteId,
        procedureId: procedure.id,
        chairId: chair.id,
        startsAt: period.startsAt,
        careEndsAt: period.careEndsAt,
        blockEndsAt: period.blockEndsAt,
        durationMinutes: times.durationMinutes,
        postIntervalMinutes: times.postIntervalMinutes,
        status: 'PROGRAMADO',
        outsideAvailability: outside,
        exceptionReason,
        cancellationReason: null,
      });
      await this.writer.insertEvents(tx.manager, this.creationEvents(id, period.startsAt, chair.id, occurredAt, exceptionReason));
      return toAppointmentResponse(await this.writer.findAppointment(tx.manager, id));
    });
  }

  private async activeReferences(input: CreateAppointmentDto, manager: EntityManager) {
    const patient = await this.patients.findById(input.pacienteId, manager);
    if (!patient) throw referenceInvalid('pacienteId', 'INEXISTENTE');
    if (!patient.activo) throw referenceInvalid('pacienteId', 'INACTIVO');
    const procedure = await this.catalogs.findProcedureById(input.prestacionId, manager);
    if (!procedure) throw referenceInvalid('prestacionId', 'INEXISTENTE');
    if (!procedure.activo) throw referenceInvalid('prestacionId', 'INACTIVO');
    const chair = await this.catalogs.findChairById(input.sillonId, manager);
    if (!chair) throw referenceInvalid('sillonId', 'INEXISTENTE');
    if (!chair.activo) throw referenceInvalid('sillonId', 'INACTIVO');
    return { patient, procedure, chair };
  }

  private creationEvents(
    appointmentId: string,
    startsAt: Date,
    chairId: string,
    occurredAt: Date,
    exceptionReason: string | null,
  ): NewAppointmentEvent[] {
    const base = {
      appointmentId,
      occurredAt,
      previousStatus: null,
      previousStartsAt: null,
      previousChairId: null,
    } as const;
    const created: NewAppointmentEvent = {
      ...base,
      id: randomUUID(),
      type: 'CREADO',
      newStatus: 'PROGRAMADO',
      newStartsAt: startsAt,
      newChairId: chairId,
      reason: null,
    };
    if (exceptionReason === null) return [created];
    return [
      created,
      { ...base, id: randomUUID(), type: 'EXCEPCION', newStatus: null, newStartsAt: startsAt, newChairId: chairId, reason: exceptionReason },
    ];
  }
}
