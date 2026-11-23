import { validateEnvironment, validateTestDatabaseEnvironment } from './env.validation.js';

const validEnvironment = {
  APP_ENV: 'test',
  BACKEND_PORT: '3000',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  APP_TIME_ZONE: 'America/Argentina/Buenos_Aires',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '3306',
  DATABASE_NAME: 'turnos_test',
  DATABASE_USER: 'test_user',
  DATABASE_PASSWORD: 'fictional_password',
  AUTH_SECRET: 'fictional-secret-with-at-least-32-characters',
} as const;

describe('environment validation', () => {
  it('parses the required application configuration', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      BACKEND_PORT: 3000,
      APP_TIME_ZONE: 'America/Argentina/Buenos_Aires',
    });
  });

  it('treats blank optional provisioning values as absent', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        INITIAL_ADMIN_EMAIL: '',
        INITIAL_ADMIN_PASSWORD: '',
      }),
    ).toMatchObject({
      INITIAL_ADMIN_EMAIL: undefined,
      INITIAL_ADMIN_PASSWORD: undefined,
    });
  });

  it('names a missing key without exposing configured secret values', () => {
    const { DATABASE_PASSWORD: _omitted, ...missingPassword } = validEnvironment;
    expect(() => validateEnvironment(missingPassword)).toThrow('DATABASE_PASSWORD');
    expect(() => validateEnvironment(missingPassword)).not.toThrow('fictional-secret');
  });

  it('fails explicitly when MariaDB integration variables are absent', () => {
    expect(() => validateTestDatabaseEnvironment({})).toThrow(
      'MariaDB integration configuration is required',
    );
  });
});
