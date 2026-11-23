import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { AppEnvironment } from '../config/env.validation.js';
import { applicationDataSourceOptions } from './data-source.js';
import { DatabaseConnectionService } from './database-connection.service.js';

@Module({
  providers: [
    {
      provide: DataSource,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnvironment, true>) =>
        new DataSource(
          applicationDataSourceOptions({
            APP_ENV: config.get('APP_ENV', { infer: true }),
            BACKEND_PORT: config.get('BACKEND_PORT', { infer: true }),
            FRONTEND_ORIGIN: config.get('FRONTEND_ORIGIN', { infer: true }),
            APP_TIME_ZONE: config.get('APP_TIME_ZONE', { infer: true }),
            DATABASE_HOST: config.get('DATABASE_HOST', { infer: true }),
            DATABASE_PORT: config.get('DATABASE_PORT', { infer: true }),
            DATABASE_NAME: config.get('DATABASE_NAME', { infer: true }),
            DATABASE_USER: config.get('DATABASE_USER', { infer: true }),
            DATABASE_PASSWORD: config.get('DATABASE_PASSWORD', { infer: true }),
            AUTH_SECRET: config.get('AUTH_SECRET', { infer: true }),
            INITIAL_ADMIN_EMAIL: config.get('INITIAL_ADMIN_EMAIL', { infer: true }),
            INITIAL_ADMIN_PASSWORD: config.get('INITIAL_ADMIN_PASSWORD', { infer: true }),
          }),
        ),
    },
    DatabaseConnectionService,
  ],
  exports: [DataSource, DatabaseConnectionService],
})
export class DatabaseModule {}
