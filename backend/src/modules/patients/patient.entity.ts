import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Index('UQ_patients_dni', ['dni'], { unique: true })
@Index('IDX_patients_name', ['name'])
@Index('IDX_patients_phone_digits', ['phoneDigits'])
@Index('IDX_patients_name_phone_digits', ['name', 'phoneDigits'])
@Entity({ name: 'patients' })
export class PatientEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column({ name: 'phone_digits', type: 'varchar', length: 20 })
  phoneDigits: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  dni: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

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
