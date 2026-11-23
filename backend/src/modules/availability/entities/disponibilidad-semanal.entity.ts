import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** Tramo recurrente en hora local: 1 = lunes … 7 = domingo. */
@Index('IDX_disponibilidad_semanal_dia', ['diaSemana', 'horaInicio'])
@Entity({ name: 'disponibilidad_semanal' })
export class DisponibilidadSemanalEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ name: 'dia_semana', type: 'tinyint' })
  diaSemana: number;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin: string;

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
