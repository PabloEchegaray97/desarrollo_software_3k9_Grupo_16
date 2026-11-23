import type { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
export const ZONA_IANA = 'America/Argentina/Buenos_Aires';
export const CONFIGURACION_UNICA_ID = '00000000-0000-4000-8000-000000000001';

/** Migración aditiva de C-03. No modifica migraciones C01 ni C02. */
export class C03CreateAvailability2026112500000 implements MigrationInterface {
  name = 'C03CreateAvailability2026112500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE configuracion_agenda (
        id CHAR(36) NOT NULL,
        singleton_flag TINYINT NOT NULL DEFAULT 1,
        intervalo_global_minutos SMALLINT NOT NULL DEFAULT 10,
        zona_horaria VARCHAR(64) NOT NULL DEFAULT '${ZONA_IANA}',
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY UQ_configuracion_agenda_single (singleton_flag),
        CONSTRAINT CHK_configuracion_single CHECK (singleton_flag = 1),
        CONSTRAINT CHK_configuracion_intervalo CHECK (intervalo_global_minutos BETWEEN 0 AND 30)
      ) ${TABLE_OPTIONS}
    `);

    await queryRunner.query(`
      CREATE TABLE disponibilidad_semanal (
        id CHAR(36) NOT NULL,
        dia_semana TINYINT NOT NULL,
        hora_inicio TIME NOT NULL,
        hora_fin TIME NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY IDX_disponibilidad_semanal_dia (dia_semana, hora_inicio),
        CONSTRAINT CHK_disponibilidad_semanal_dia CHECK (dia_semana BETWEEN 1 AND 7),
        CONSTRAINT CHK_disponibilidad_semanal_horas CHECK (hora_inicio < hora_fin)
      ) ${TABLE_OPTIONS}
    `);

    await queryRunner.query(`
      CREATE TABLE excepcion_disponibilidad (
        id CHAR(36) NOT NULL,
        fecha DATE NOT NULL,
        tipo VARCHAR(24) NOT NULL,
        motivo VARCHAR(255) NOT NULL,
        hora_inicio TIME NULL,
        hora_fin TIME NULL,
        inicio_utc DATETIME(6) NULL,
        fin_utc DATETIME(6) NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY IDX_excepcion_disponibilidad_fecha (fecha),
        KEY IDX_excepcion_disponibilidad_fecha_activo (fecha, activo),
        CONSTRAINT CHK_excepcion_disponibilidad_tipo CHECK (tipo IN ('FERIADO', 'VACACIONES', 'BLOQUEO')),
        CONSTRAINT CHK_excepcion_disponibilidad_motivo CHECK (CHAR_LENGTH(TRIM(motivo)) > 0),
        CONSTRAINT CHK_excepcion_disponibilidad_rango CHECK (
          (hora_inicio IS NULL AND hora_fin IS NULL)
          OR (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_inicio < hora_fin)
        )
      ) ${TABLE_OPTIONS}
    `);

    await queryRunner.query(`
      INSERT INTO configuracion_agenda (id, intervalo_global_minutos, zona_horaria)
      VALUES (?, 10, ?)
    `, [CONFIGURACION_UNICA_ID, ZONA_IANA]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS excepcion_disponibilidad');
    await queryRunner.query('DROP TABLE IF EXISTS disponibilidad_semanal');
    await queryRunner.query('DROP TABLE IF EXISTS configuracion_agenda');
  }
}
