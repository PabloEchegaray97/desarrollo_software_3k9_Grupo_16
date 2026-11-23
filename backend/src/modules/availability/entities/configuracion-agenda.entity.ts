import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

/** Fila única de configuración del consultorio. Horas locales, zona IANA. */
@Entity({ name: 'configuracion_agenda' })
export class ConfiguracionAgendaEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  /** Siempre 1: la restricción UNIQUE garantiza una sola fila de configuración. */
  @Column({ name: 'singleton_flag', type: 'tinyint', default: 1 })
  singletonFlag: number;

  @Column({ name: 'intervalo_global_minutos', type: 'smallint' })
  intervaloGlobalMinutos: number;

  @Column({ name: 'zona_horaria', type: 'varchar', length: 64 })
  zonaHoraria: string;

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
