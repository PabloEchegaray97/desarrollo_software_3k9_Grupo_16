import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import {
  validateEnvironment,
  validateTestDatabaseEnvironment,
  type AppEnvironment,
  type TestDatabaseEnvironment,
} from '../config/env.validation.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export function applicationDataSourceOptions(environment: AppEnvironment): DataSourceOptions {
  return {
    type: 'mariadb',
    host: environment.DATABASE_HOST,
    port: environment.DATABASE_PORT,
    database: environment.DATABASE_NAME,
    username: environment.DATABASE_USER,
    password: environment.DATABASE_PASSWORD,
    entities: [path.join(currentDirectory, '..', '**', '*.entity.{js,ts}')],
    migrations: [path.join(currentDirectory, 'migrations', '*.{js,ts}')],
    migrationsTableName: 'app_migrations',
    synchronize: false,
    logging: false,
  };
}

export function testDataSourceOptions(environment: TestDatabaseEnvironment): DataSourceOptions {
  return {
    type: 'mariadb',
    host: environment.TEST_DATABASE_HOST,
    port: environment.TEST_DATABASE_PORT,
    database: environment.TEST_DATABASE_NAME,
    username: environment.TEST_DATABASE_USER,
    password: environment.TEST_DATABASE_PASSWORD,
    migrations: [path.join(currentDirectory, 'migrations', '*.{js,ts}')],
    migrationsTableName: 'app_migrations',
    synchronize: false,
    logging: false,
  };
}

export function createApplicationDataSource(input: Record<string, unknown>): DataSource {
  return new DataSource(applicationDataSourceOptions(validateEnvironment(input)));
}

export function createTestDataSource(input: Record<string, unknown>): DataSource {
  return new DataSource(testDataSourceOptions(validateTestDatabaseEnvironment(input)));
}
