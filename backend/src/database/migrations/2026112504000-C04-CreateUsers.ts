import type { MigrationInterface, QueryRunner } from 'typeorm';

export class C04CreateUsers2026112504000 implements MigrationInterface {
  name = 'C04CreateUsers2026112504000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id CHAR(36) NOT NULL,
        email VARCHAR(254) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'ODONTOLOGO',
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY UQ_users_email (email),
        CONSTRAINT CHK_users_role CHECK (role = 'ODONTOLOGO')
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE users');
  }
}
