import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { validateEnvironment } from './config/env.validation.js';
import { loadEnvironment } from './config/load-environment.js';

async function bootstrap() {
  loadEnvironment();
  const environment = validateEnvironment(process.env);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({ origin: environment.FRONTEND_ORIGIN, credentials: true });
  await app.listen(environment.BACKEND_PORT);
}
await bootstrap();
