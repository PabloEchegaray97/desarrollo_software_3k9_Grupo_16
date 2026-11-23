/**
 * Soporte de las pruebas de API de C-03 (no es una suite).
 * Usa MariaDB real y una sola fuente de datos con `timezone: 'Z'` para que
 * las lecturas de DATETIME no dependan de la zona del proceso.
 * El sufijo `.support-spec.ts` no coincide con los `testMatch` de Jest ni con
 * el patrón `*.spec.ts` del build.
 */
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { validateTestDatabaseEnvironment } from '../../../config/env.validation.js';
import { testDataSourceOptions } from '../../../database/data-source.js';
import { ConfiguracionAgendaEntity } from '../entities/configuracion-agenda.entity.js';
import { DisponibilidadSemanalEntity } from '../entities/disponibilidad-semanal.entity.js';
import { ExcepcionDisponibilidadEntity } from '../entities/excepcion-disponibilidad.entity.js';
import { ChairEntity } from '../../catalogs/chair.entity.js';
import { ProcedureEntity } from '../../catalogs/procedure.entity.js';
import { PatientEntity } from '../../patients/patient.entity.js';

export interface AvailabilityApiContext {
  app: INestApplication<App>;
  dataSource: DataSource;
}

/** Levanta `AppModule` contra la base de pruebas con la configuración temporal de C-03. */
export async function startAvailabilityApi(): Promise<AvailabilityApiContext> {
  const dataSource = new DataSource({
    ...testDataSourceOptions(validateTestDatabaseEnvironment(process.env)),
    timezone: 'Z',
    entities: [
      ConfiguracionAgendaEntity,
      DisponibilidadSemanalEntity,
      ExcepcionDisponibilidadEntity,
      ChairEntity,
      ProcedureEntity,
      PatientEntity,
    ],
  });
  await dataSource.initialize();
  await dataSource.runMigrations({ transaction: 'all' });

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
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DataSource)
    .useValue(dataSource)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.init();
  return { app, dataSource };
}

export async function stopAvailabilityApi(context: AvailabilityApiContext | undefined): Promise<void> {
  if (context === undefined) return;
  await context.app.close();
  if (context.dataSource.isInitialized) await context.dataSource.destroy();
}

/** Deja la configuración en su valor inicial y limpia tramos y excepciones. */
export async function resetAvailabilityData(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM excepcion_disponibilidad');
  await dataSource.query('DELETE FROM disponibilidad_semanal');
  await dataSource.query(
    `UPDATE configuracion_agenda
     SET intervalo_global_minutos = 10, zona_horaria = 'America/Argentina/Buenos_Aires'
     WHERE id = '00000000-0000-4000-8000-000000000001'`,
  );
}

/** Contrato común de error: estado, requestId y mensaje seguro. El `code` depende de CR-01. */
export function expectApiError(response: Response, status: number): void {
  expect(response.status).toBe(status);
  const body = response.body as { error?: { requestId?: unknown; message?: unknown } };
  expect(typeof body.error?.requestId).toBe('string');
  expect(typeof body.error?.message).toBe('string');
}
