import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';

const testEnvironment = {
  APP_ENV: 'test',
  BACKEND_PORT: '3000',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  APP_TIME_ZONE: 'America/Argentina/Buenos_Aires',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '1',
  DATABASE_NAME: 'unavailable',
  DATABASE_USER: 'fictional_user',
  DATABASE_PASSWORD: 'fictional_password',
  AUTH_SECRET: 'fictional-secret-with-at-least-32-characters',
};

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    Object.assign(process.env, testEnvironment);
    const { AppModule } = await import('./../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET) reports database degradation safely', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(503)
      .expect({ status: 'degraded', database: 'down' });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
