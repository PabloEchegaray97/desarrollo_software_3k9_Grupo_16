import type { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

export class C02CreatePatientsAndCatalogs2026112400000 implements MigrationInterface {
  name = 'C02CreatePatientsAndCatalogs2026112400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE procedures (
        id CHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        default_duration_minutes SMALLINT NOT NULL,
        post_interval_minutes SMALLINT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY UQ_procedures_name (name),
        KEY IDX_procedures_active_name (active, name),
        CONSTRAINT CHK_procedures_duration CHECK (default_duration_minutes BETWEEN 1 AND 240),
        CONSTRAINT CHK_procedures_interval CHECK (post_interval_minutes IS NULL OR post_interval_minutes BETWEEN 0 AND 30)
      ) ${TABLE_OPTIONS}
    `);

    await queryRunner.query(`
      CREATE TABLE chairs (
        id CHAR(36) NOT NULL,
        name VARCHAR(60) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY UQ_chairs_name (name),
        KEY IDX_chairs_active_name (active, name)
      ) ${TABLE_OPTIONS}
    `);

    await queryRunner.query(`
      CREATE TABLE patients (
        id CHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        phone_digits VARCHAR(20) NOT NULL,
        dni VARCHAR(8) NULL,
        email VARCHAR(254) NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY UQ_patients_dni (dni),
        KEY IDX_patients_name (name),
        KEY IDX_patients_phone_digits (phone_digits),
        KEY IDX_patients_name_phone_digits (name, phone_digits)
      ) ${TABLE_OPTIONS}
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS patients');
    await queryRunner.query('DROP TABLE IF EXISTS chairs');
    await queryRunner.query('DROP TABLE IF EXISTS procedures');
  }
}
