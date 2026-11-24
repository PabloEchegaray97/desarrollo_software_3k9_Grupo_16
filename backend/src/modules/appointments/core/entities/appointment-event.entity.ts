import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { AppointmentEventType, AppointmentStatus } from '../domain/appointment-status.js';
import { AppointmentEntity } from './appointment.entity.js';

/** Evento inmutable del historial de un turno (RN-AU). */
@Index('IDX_appointment_events_appointment', ['appointmentId', 'occurredAt'])
@Check('CHK_appointment_events_type', "type IN ('CREADO','REPROGRAMADO','CANCELADO','CAMBIO_ESTADO','EXCEPCION')")
@Check(
  'CHK_appointment_events_previous_status',
  "previous_status IS NULL OR previous_status IN ('PROGRAMADO','CONFIRMADO','ATENDIDO','CANCELADO','AUSENTE')",
)
@Check(
  'CHK_appointment_events_new_status',
  "new_status IS NULL OR new_status IN ('PROGRAMADO','CONFIRMADO','ATENDIDO','CANCELADO','AUSENTE')",
)
@Entity({ name: 'appointment_events' })
export class AppointmentEventEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ name: 'appointment_id', type: 'char', length: 36 })
  appointmentId: string;

  @ManyToOne(() => AppointmentEntity, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn({ name: 'appointment_id', foreignKeyConstraintName: 'FK_appointment_events_appointment' })
  appointment?: AppointmentEntity;

  @Column({ type: 'varchar', length: 16 })
  type: AppointmentEventType;

  @Column({ name: 'occurred_at', type: 'datetime', precision: 6 })
  occurredAt: Date;

  @Column({ name: 'previous_status', type: 'varchar', length: 16, nullable: true })
  previousStatus: AppointmentStatus | null;

  @Column({ name: 'new_status', type: 'varchar', length: 16, nullable: true })
  newStatus: AppointmentStatus | null;

  @Column({ name: 'previous_starts_at', type: 'datetime', precision: 6, nullable: true })
  previousStartsAt: Date | null;

  @Column({ name: 'new_starts_at', type: 'datetime', precision: 6, nullable: true })
  newStartsAt: Date | null;

  @Column({ name: 'previous_chair_id', type: 'char', length: 36, nullable: true })
  previousChairId: string | null;

  @Column({ name: 'new_chair_id', type: 'char', length: 36, nullable: true })
  newChairId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;
}
