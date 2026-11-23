import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** Excepción bloqueante por fecha local; sin rango equivale a día completo. */
@Index('IDX_excepcion_disponibilidad_fecha', ['fecha'])
@Entity({ name: 'excepcion_disponibilidad' })
export class ExcepcionDisponibilidadEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'varchar', length: 24 })
  tipo: string;

  @Column({ type: 'varchar', length: 255 })
  motivo: string;

  @Column({ name: 'hora_inicio', type: 'time', nullable: true })
  horaInicio: string | null;

  @Column({ name: 'hora_fin', type: 'time', nullable: true })
  horaFin: string | null;

  /** Instantes calculados en UTC; la zona IANA nunca se guarda como offset. */
  @Column({ name: 'inicio_utc', type: 'datetime', precision: 6, nullable: true })
  inicioUtc: Date | null;

  @Column({ name: 'fin_utc', type: 'datetime', precision: 6, nullable: true })
  finUtc: Date | null;

  /** Baja lógica: una excepción cancelada se conserva para auditoría. */
  @Column({ type: 'boolean', default: true })
  activo: boolean;

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
