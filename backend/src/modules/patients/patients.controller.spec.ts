import { jest } from '@jest/globals';
import { Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ApiExceptionFilter } from '../../shared/http/api-exception.filter.js';
import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';

const PATIENT_ID = '3d2a0c74-9f20-4da0-9f5c-4b3e7a8c9d02';

describe('PatientsController (sin base de datos)', () => {
  let app: INestApplication<App>;
  const patients = {
    list: jest.fn(async () => ({ items: [], page: 1, pageSize: 20, total: 0 })),
    findById: jest.fn(async () => ({})),
    create: jest.fn(async () => ({ id: PATIENT_ID })),
    replace: jest.fn(async () => ({})),
    setActive: jest.fn(async () => ({})),
  };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [{ provide: PatientsService, useValue: patients }],
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

  it('crea con 201 y entrega datos normalizados al servicio', async () => {
    await request(app.getHttpServer())
      .post('/api/pacientes')
      .send({ nombre: '  Paciente   Ficticio  Dos ', telefono: '11 5555-0002', dni: '30.000.002', email: '' })
      .expect(201);
    expect(patients.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Paciente Ficticio Dos', telefono: '11 5555-0002', dni: '30000002', email: null }),
    );
  });

  it.each([
    [{ telefono: '11 5555-0001' }],
    [{ nombre: 'Paciente Ficticio Uno', telefono: 'llamar al consultorio' }],
    [{ nombre: 'Paciente Ficticio Uno', telefono: '11 5555-0001', email: 'no-es-un-email' }],
    [{ nombre: 'Paciente Ficticio Uno', telefono: '11 5555-0001', dni: '12A45' }],
  ])('rechaza %p con VALIDATION_ERROR sin llamar al servicio', async (body) => {
    const response = await request(app.getHttpServer()).post('/api/pacientes').send(body).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(patients.create).not.toHaveBeenCalled();
  });

  it('convierte la búsqueda y rechaza paginación inválida', async () => {
    await request(app.getHttpServer()).get('/api/pacientes?q=ficticio%20uno&incluirInactivos=true&page=2').expect(200);
    expect(patients.list).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'ficticio uno', incluirInactivos: true, page: 2, pageSize: 20 }),
    );
    await request(app.getHttpServer()).get('/api/pacientes?page=0').expect(400);
    await request(app.getHttpServer()).get('/api/pacientes?pageSize=500').expect(400);
  });

  it('edita con PUT y cambia estado con PATCH', async () => {
    await request(app.getHttpServer())
      .put(`/api/pacientes/${PATIENT_ID}`)
      .send({ nombre: 'Paciente Ficticio Uno', telefono: '11 5555-0001', confirmarPosibleDuplicado: true })
      .expect(200);
    expect(patients.replace).toHaveBeenCalledWith(PATIENT_ID, expect.objectContaining({ confirmarPosibleDuplicado: true }));

    await request(app.getHttpServer()).patch(`/api/pacientes/${PATIENT_ID}/estado`).send({ activo: false }).expect(200);
    expect(patients.setActive).toHaveBeenCalledWith(PATIENT_ID, false);
  });

  it('rechaza ids que no son UUID y no expone DELETE', async () => {
    await request(app.getHttpServer()).get('/api/pacientes/123').expect(400);
    await request(app.getHttpServer()).delete(`/api/pacientes/${PATIENT_ID}`).expect(404);
  });
});
