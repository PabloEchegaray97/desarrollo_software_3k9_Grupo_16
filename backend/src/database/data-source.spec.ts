import type { AppEnvironment, TestDatabaseEnvironment } from '../config/env.validation.js';
import { applicationDataSourceOptions, testDataSourceOptions } from './data-source.js';

const applicationEnvironment: AppEnvironment = {
  APP_ENV: 'test',
  BACKEND_PORT: 3000,
  FRONTEND_ORIGIN: 'http://localhost:5173',
  APP_TIME_ZONE: 'America/Argentina/Buenos_Aires',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: 3306,
  DATABASE_NAME: 'turnos_odontologia',
  DATABASE_USER: 'test_user',
  DATABASE_PASSWORD: 'fictional_password',
  AUTH_SECRET: 'fictional-secret-with-at-least-32-characters',
};

const testEnvironment: TestDatabaseEnvironment = {
  TEST_DATABASE_HOST: 'localhost',
  TEST_DATABASE_PORT: 3306,
  TEST_DATABASE_NAME: 'turnos_odontologia_test',
  TEST_DATABASE_USER: 'test_user',
  TEST_DATABASE_PASSWORD: 'fictional_password',
};

describe('DataSource timezone', () => {
  it('converts application DATETIME values as UTC', () => {
    expect(applicationDataSourceOptions(applicationEnvironment)).toMatchObject({
      type: 'mariadb',
      timezone: 'Z',
    });
  });

  it('converts integration DATETIME values as UTC', () => {
    expect(testDataSourceOptions(testEnvironment)).toMatchObject({
      type: 'mariadb',
      timezone: 'Z',
    });
  });
});
