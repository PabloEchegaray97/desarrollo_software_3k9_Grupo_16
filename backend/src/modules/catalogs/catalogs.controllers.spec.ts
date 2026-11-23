import { jest } from '@jest/globals';
import { Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ApiExceptionFilter } from '../../shared/http/api-exception.filter.js';
import { ChairsController, ProceduresController } from './catalogs.controllers.js';
import { ChairsService } from './chairs.service.js';
import { ProceduresService } from './procedures.service.js';

const PROCEDURE_ID = '1b0f8a52-7d0e-4b8e-9d3a-2f1c5e6a7b80';

describe('controladores de catálogos (sin base de datos)', () => {
  let app: INestApplication<App>;
  const procedures = {
    list: jest.fn(async () => ({ items: [], page: 1, pageSize: 20, total: 0 })),
    findById: jest.fn(async () => ({})),
    create: jest.fn(async () => ({ id: PROCEDURE_ID })),
    replace: jest.fn(async () => ({})),
    setActive: jest.fn(async () => ({})),
  };
  const chairs = { ...procedures, list: jest.fn(async () => ({ items: [], page: 1, pageSize: 20, total: 0 })) };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [ProceduresController, ChairsController],
      providers: [
        { provide: ProceduresService, useValue: procedures },
        { provide: ChairsService, useValue: chairs },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => jest.clearAllMocks());

  it('lista prestaciones con query convertida y valores por defecto', async () => {
    await request(app.getHttpServer()).get('/api/prestaciones?q=control&incluirInactivos=true').expect(200);
    expect(procedures.list).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'control', incluirInactivos: true, page: 1, pageSize: 20 }),
    );
  });

  it('crea con 201 y pasa el nombre normalizado', async () => {
    await request(app.getHttpServer())
      .post('/api/prestaciones')
      .send({ nombre: '  Control   ficticio ', duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: null })
      .expect(201);
    expect(procedures.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30 }),
    );
  });

  it('rechaza duración fuera de rango con VALIDATION_ERROR sin llamar al servicio', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/prestaciones')
      .send({ nombre: 'Control ficticio', duracionPredeterminadaMinutos: 241 })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(procedures.create).not.toHaveBeenCalled();
  });

  it('rechaza pageSize mayor a 100', async () => {
    const response = await request(app.getHttpServer()).get('/api/sillones?pageSize=500').expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza ids que no son UUID', async () => {
    await request(app.getHttpServer()).get('/api/sillones/no-es-uuid').expect(400);
    expect(chairs.findById).not.toHaveBeenCalled();
  });

  it('cambia el estado con PATCH /:id/estado', async () => {
    await request(app.getHttpServer()).patch(`/api/sillones/${PROCEDURE_ID}/estado`).send({ activo: false }).expect(200);
    expect(chairs.setActive).toHaveBeenCalledWith(PROCEDURE_ID, false);
  });

  it('reemplaza con PUT', async () => {
    await request(app.getHttpServer()).put(`/api/sillones/${PROCEDURE_ID}`).send({ nombre: 'Sillón 3' }).expect(200);
    expect(chairs.replace).toHaveBeenCalledWith(PROCEDURE_ID, expect.objectContaining({ nombre: 'Sillón 3' }));
  });

  it.each(['/api/prestaciones', '/api/sillones'])('no expone DELETE en %s', async (path) => {
    await request(app.getHttpServer()).delete(`${path}/${PROCEDURE_ID}`).expect(404);
  });
});
