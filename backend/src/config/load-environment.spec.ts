import type { PathLike } from 'node:fs';
import { jest } from '@jest/globals';
import { loadEnvironment } from './load-environment.js';

describe('loadEnvironment', () => {
  it('loads the backend environment file in development', () => {
    const environment: NodeJS.ProcessEnv = { APP_ENV: 'development' };
    const loadEnvFile = jest.fn((path?: PathLike) => {
      expect(String(path)).toBe('backend/.env');
      environment.DATABASE_NAME = 'odosoft_dev';
    });

    loadEnvironment({ environment, envFilePath: 'backend/.env', loadEnvFile });

    expect(loadEnvFile).toHaveBeenCalledTimes(1);
    expect(environment.DATABASE_NAME).toBe('odosoft_dev');
  });

  it('ignores only a missing environment file', () => {
    const missingFileError = new Error('file not found') as NodeJS.ErrnoException;
    missingFileError.code = 'ENOENT';

    expect(() =>
      loadEnvironment({
        environment: { APP_ENV: 'development' },
        loadEnvFile: () => {
          throw missingFileError;
        },
      }),
    ).not.toThrow();
  });

  it('propagates unexpected environment file errors', () => {
    const unexpectedError = new Error('permission denied');

    expect(() =>
      loadEnvironment({
        environment: { APP_ENV: 'development' },
        loadEnvFile: () => {
          throw unexpectedError;
        },
      }),
    ).toThrow(unexpectedError);
  });

  it('preserves variables already defined by the process', () => {
    const environment: NodeJS.ProcessEnv = {
      APP_ENV: 'development',
      DATABASE_HOST: 'process-host',
    };

    loadEnvironment({
      environment,
      loadEnvFile: () => {
        environment.DATABASE_HOST = 'file-host';
        environment.DATABASE_NAME = 'odosoft_dev';
      },
    });

    expect(environment).toMatchObject({
      DATABASE_HOST: 'process-host',
      DATABASE_NAME: 'odosoft_dev',
    });
  });

  it('does not load a local file outside development', () => {
    const loadEnvFile = jest.fn();

    loadEnvironment({ environment: { APP_ENV: 'production' }, loadEnvFile });

    expect(loadEnvFile).not.toHaveBeenCalled();
  });
});
