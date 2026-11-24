import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ChairEntity } from '../../../catalogs/chair.entity.js';
import { ProcedureEntity } from '../../../catalogs/procedure.entity.js';
import { PatientEntity } from '../../../patients/patient.entity.js';
import type { AppointmentStatus } from '../domain/appointment-status.js';

/** Turno del único odontólogo. Instantes UTC; duración e intervalo efectivos copiados al crear. */
@Index('IDX_appointments_status_period', ['status', 'startsAt', 'blockEndsAt'])
@Index('IDX_appointments_chair_starts', ['chairId', 'startsAt'])
@Index('IDX_appointments_patient_starts', ['patientId', 'startsAt'])
@Index('IDX_appointments_procedure', ['procedureId'])
@Check('CHK_appointments_duration', 'duration_minutes BETWEEN 1 AND 240')
@Check('CHK_appointments_interval', 'post_interval_minutes BETWEEN 0 AND 30')
@Check('CHK_appointments_status', "status IN ('PROGRAMADO','CONFIRMADO','ATENDIDO','CANCELADO','AUSENTE')")
@Check('CHK_appointments_period', 'starts_at < care_ends_at AND care_ends_at <= block_ends_at')
@Check('CHK_appointments_exception_reason', 'outside_availability = FALSE OR exception_reason IS NOT NULL')
@Entity({ name: 'appointments' })
export class AppointmentEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ name: 'patient_id', type: 'char', length: 36 })
  patientId: string;

  @ManyToOne(() => PatientEntity, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id', foreignKeyConstraintName: 'FK_appointments_patient' })
  patient?: PatientEntity;

  @Column({ name: 'procedure_id', type: 'char', length: 36 })
  procedureId: string;

  @ManyToOne(() => ProcedureEntity, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn({ name: 'procedure_id', foreignKeyConstraintName: 'FK_appointments_procedure' })
  procedure?: ProcedureEntity;

  @Column({ name: 'chair_id', type: 'char', length: 36 })
  chairId: string;

  @ManyToOne(() => ChairEntity, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' })
  @JoinColumn({ name: 'chair_id', foreignKeyConstraintName: 'FK_appointments_chair' })
  chair?: ChairEntity;

  @Column({ name: 'starts_at', type: 'datetime', precision: 6 })
  startsAt: Date;

  @Column({ name: 'care_ends_at', type: 'datetime', precision: 6 })
  careEndsAt: Date;

  @Column({ name: 'block_ends_at', type: 'datetime', precision: 6 })
  blockEndsAt: Date;

  @Column({ name: 'duration_minutes', type: 'smallint' })
  durationMinutes: number;

  @Column({ name: 'post_interval_minutes', type: 'smallint' })
  postIntervalMinutes: number;

  @Column({ type: 'varchar', length: 16 })
  status: AppointmentStatus;

  @Column({ name: 'outside_availability', type: 'boolean', default: false })
  outsideAvailability: boolean;

  @Column({ name: 'exception_reason', type: 'varchar', length: 500, nullable: true })
  exceptionReason: string | null;

  /** Definido por la KB; lo escribe C-06 al cancelar. */
  @Column({ name: 'cancellation_reason', type: 'varchar', length: 500, nullable: true })
  cancellationReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  /** Lo mantiene MariaDB con microsegundos (`ON UPDATE CURRENT_TIMESTAMP(6)`). */
  @Column({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
    insert: false,
    update: false,
  })
  updatedAt: Date;
}
