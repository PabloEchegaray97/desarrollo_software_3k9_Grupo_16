import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class C01CreateAppMetadata2026112300000 implements MigrationInterface {
  name = 'C01CreateAppMetadata2026112300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'app_metadata',
        columns: [
          { name: 'metadata_key', type: 'varchar', length: '100', isPrimary: true },
          { name: 'metadata_value', type: 'varchar', length: '255' },
          { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('app_metadata', true);
  }
}
