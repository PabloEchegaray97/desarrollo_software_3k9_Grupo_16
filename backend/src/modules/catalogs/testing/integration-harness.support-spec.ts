/**
 * Soporte compartido por las pruebas de integración de C-02 (no es una suite).
 * El sufijo `.support-spec.ts` lo excluye del build (`**\/*spec.ts`) y no coincide
 * con `*.spec.ts` ni con `*.integration-spec.ts`, así que Jest no lo ejecuta solo.
 *
 * Usa MariaDB real mediante `TEST_DATABASE_*`; nunca SQLite ni base en memoria.
 */
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../../../database/data-source.js';
import { authenticatedCookie } from '../../auth/testing/session-test.support-spec.js';

export interface IntegrationContext {
  app: INestApplication<App>;
  dataSource: DataSource;
  sessionCookie: string;
}

/** Aplica migraciones sobre la base de pruebas y levanta `AppModule` como en `main.ts`. */
export async function startIntegrationApp(): Promise<IntegrationContext> {
  const dataSource = createTestDataSource(process.env);
  await dataSource.initialize();
  await dataSource.runMigrations({ transaction: 'all' });
  const sessionCookie = await authenticatedCookie(dataSource);

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
  const { AppModule } = await import('../../../app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.init();
  return { app, dataSource, sessionCookie };
}

export async function stopIntegrationApp(context: IntegrationContext | undefined): Promise<void> {
  if (!context) return;
  await context.app.close();
  if (context.dataSource.isInitialized) await context.dataSource.destroy();
}

/** Deja vacías las tablas de C-02 antes de cada prueba. */
export async function clearC02Tables(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM patients');
  await dataSource.query('DELETE FROM procedures');
  await dataSource.query('DELETE FROM chairs');
}

/**
 * Comprueba el contrato común de error. El `code` se verifica al final porque
 * depende de CR-01 (el filtro global debe propagar los códigos de dominio).
 */
export function expectApiError(response: Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  const body = response.body as { error?: { requestId?: unknown; message?: unknown; code?: unknown } };
  expect(typeof body.error?.requestId).toBe('string');
  expect(typeof body.error?.message).toBe('string');
  expect(body.error?.code).toBe(code);
}
