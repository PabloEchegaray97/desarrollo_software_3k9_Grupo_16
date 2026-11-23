import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { validateEnvironment } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AppointmentsModule } from './modules/appointments/appointments.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AvailabilityModule } from './modules/availability/availability.module.js';
import { CatalogsModule } from './modules/catalogs/catalogs.module.js';
import { PatientsModule } from './modules/patients/patients.module.js';
import { ApiExceptionFilter } from './shared/http/api-exception.filter.js';
import { RequestIdMiddleware } from './shared/http/request-id.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    HealthModule,
    PatientsModule,
    CatalogsModule,
    AvailabilityModule,
    AuthModule,
    AppointmentsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
