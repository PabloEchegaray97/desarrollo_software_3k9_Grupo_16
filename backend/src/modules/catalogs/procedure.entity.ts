import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Index('UQ_procedures_name', ['name'], { unique: true })
@Index('IDX_procedures_active_name', ['active', 'name'])
@Check('CHK_procedures_duration', 'default_duration_minutes BETWEEN 1 AND 240')
@Check('CHK_procedures_interval', 'post_interval_minutes IS NULL OR post_interval_minutes BETWEEN 0 AND 30')
@Entity({ name: 'procedures' })
export class ProcedureEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'default_duration_minutes', type: 'smallint' })
  defaultDurationMinutes: number;

  @Column({ name: 'post_interval_minutes', type: 'smallint', nullable: true })
  postIntervalMinutes: number | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

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
