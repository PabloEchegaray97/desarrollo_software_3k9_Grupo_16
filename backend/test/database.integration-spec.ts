import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestDataSource } from '../src/database/data-source.js';

describe('MariaDB migrations (integration)', () => {
  it('runs all migrations and preserves later changes while verifying C-01', async () => {
    const dataSource = createTestDataSource(process.env);
    await dataSource.initialize();
    try {
      await dataSource.runMigrations({ transaction: 'all' });
      const rows = (await dataSource.query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_metadata'",
      )) as Array<{ TABLE_NAME: string }>;
      expect(rows).toHaveLength(1);
      const migrations = (await dataSource.query(
        'SELECT name FROM app_migrations ORDER BY id',
      )) as Array<{ name: string }>;
      expect(migrations.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          'C01CreateAppMetadata2026112300000',
          'C04CreateUsers2026112504000',
        ]),
      );
    } finally {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  });

  it('reports HTTP 200 through /api/health with the real MariaDB connection', async () => {
    Object.assign(process.env, {
      APP_ENV: 'test',
      BACKEND_PORT: '3000',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      APP_TIME_ZONE: 'America/Argentina/Buenos_Aires',
      DATABASE_HOST: process.env.TEST_DATABASE_HOST,
      DATABASE_PORT: process.env.TEST_DATABASE_PORT,
      DATABASE_NAME: process.env.TEST_DATABASE_NAME,
      DATABASE_USER: process.env.TEST_DATABASE_USER,
      DATABASE_PASSWORD: process.env.TEST_DATABASE_PASSWORD,
      AUTH_SECRET: 'fictional-integration-secret-at-least-32-characters',
    });
    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app: INestApplication<App> = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');

    try {
      await app.init();
      await request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect({ status: 'ok', database: 'up' });
    } finally {
      await app.close();
    }
  });
});
