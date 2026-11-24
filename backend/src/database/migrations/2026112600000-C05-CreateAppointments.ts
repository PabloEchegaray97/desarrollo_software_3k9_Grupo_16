import type { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
const STATUSES = "'PROGRAMADO','CONFIRMADO','ATENDIDO','CANCELADO','AUSENTE'";
const EVENT_TYPES = "'CREADO','REPROGRAMADO','CANCELADO','CAMBIO_ESTADO','EXCEPCION'";

/** Turnos e historial (C-05). Instantes en UTC; duración e intervalo efectivos copiados al turno. */
export class C05CreateAppointments2026112600000 implements MigrationInterface {
  name = 'C05CreateAppointments2026112600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE appointments (
        id CHAR(36) NOT NULL,
        patient_id CHAR(36) NOT NULL,
        procedure_id CHAR(36) NOT NULL,
        chair_id CHAR(36) NOT NULL,
        starts_at DATETIME(6) NOT NULL,
        care_ends_at DATETIME(6) NOT NULL,
        block_ends_at DATETIME(6) NOT NULL,
        duration_minutes SMALLINT NOT NULL,
        post_interval_minutes SMALLINT NOT NULL,
        status VARCHAR(16) NOT NULL,
        outside_availability BOOLEAN NOT NULL DEFAULT FALSE,
        exception_reason VARCHAR(500) NULL,
        cancellation_reason VARCHAR(500) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY IDX_appointments_status_period (status, starts_at, block_ends_at),
        KEY IDX_appointments_chair_starts (chair_id, starts_at),
        KEY IDX_appointments_patient_starts (patient_id, starts_at),
        KEY IDX_appointments_procedure (procedure_id),
        CONSTRAINT FK_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
        CONSTRAINT FK_appointments_procedure FOREIGN KEY (procedure_id) REFERENCES procedures (id) ON DELETE RESTRICT,
        CONSTRAINT FK_appointments_chair FOREIGN KEY (chair_id) REFERENCES chairs (id) ON DELETE RESTRICT,
        CONSTRAINT CHK_appointments_duration CHECK (duration_minutes BETWEEN 1 AND 240),
        CONSTRAINT CHK_appointments_interval CHECK (post_interval_minutes BETWEEN 0 AND 30),
        CONSTRAINT CHK_appointments_status CHECK (status IN (${STATUSES})),
        CONSTRAINT CHK_appointments_period CHECK (starts_at < care_ends_at AND care_ends_at <= block_ends_at),
        CONSTRAINT CHK_appointments_exception_reason CHECK (outside_availability = FALSE OR exception_reason IS NOT NULL)
      ) ${TABLE_OPTIONS}
    `);

    await queryRunner.query(`
      CREATE TABLE appointment_events (
        id CHAR(36) NOT NULL,
        appointment_id CHAR(36) NOT NULL,
        type VARCHAR(16) NOT NULL,
        occurred_at DATETIME(6) NOT NULL,
        previous_status VARCHAR(16) NULL,
        new_status VARCHAR(16) NULL,
        previous_starts_at DATETIME(6) NULL,
        new_starts_at DATETIME(6) NULL,
        previous_chair_id CHAR(36) NULL,
        new_chair_id CHAR(36) NULL,
        reason VARCHAR(500) NULL,
        PRIMARY KEY (id),
        KEY IDX_appointment_events_appointment (appointment_id, occurred_at),
        CONSTRAINT FK_appointment_events_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE RESTRICT,
        CONSTRAINT CHK_appointment_events_type CHECK (type IN (${EVENT_TYPES})),
        CONSTRAINT CHK_appointment_events_previous_status CHECK (previous_status IS NULL OR previous_status IN (${STATUSES})),
        CONSTRAINT CHK_appointment_events_new_status CHECK (new_status IS NULL OR new_status IN (${STATUSES}))
      ) ${TABLE_OPTIONS}
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS appointment_events');
    await queryRunner.query('DROP TABLE IF EXISTS appointments');
  }
}
