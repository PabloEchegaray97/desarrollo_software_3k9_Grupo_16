import { jest } from '@jest/globals';
import { HttpStatus, Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ApiExceptionFilter } from '../../../shared/http/api-exception.filter.js';
import { AppointmentError } from './appointment-errors.js';
import { AppointmentsController } from './appointments.controller.js';
import { CreateAppointmentService } from './create-appointment.service.js';

const body = {
  pacienteId: '3d2a0c74-9f20-4da0-9f5c-4b3e7a8c9d02',
  prestacionId: '1b0f8a52-7d0e-4b8e-9d3a-2f1c5e6a7b80',
  sillonId: '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91',
  fecha: '2027-03-10',
  horaInicio: '10:00',
};

describe('AppointmentsController (sin base de datos)', () => {
  let app: INestApplication<App>;
  const creation = { create: jest.fn(async () => ({ id: 'turno-ficticio', estado: 'PROGRAMADO' })) };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [{ provide: CreateAppointmentService, useValue: creation }],
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

  it('crea con 201 y entrega el motivo recortado al servicio', async () => {
    await request(app.getHttpServer())
      .post('/api/turnos')
      .send({ ...body, fueraDisponibilidad: true, motivoExcepcion: '  Urgencia ficticia ' })
      .expect(201);
    expect(creation.create).toHaveBeenCalledWith(expect.objectContaining({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' }));
  });

  it.each([
    [{ ...body, horaInicio: '25:00' }],
    [{ ...body, duracionMinutos: 241 }],
    [{ ...body, intervaloPosteriorMinutos: 31 }],
    [{ ...body, fueraDisponibilidad: true }],
    [{ ...body, sillonId: 'sillon-1' }],
  ])('rechaza %p con VALIDATION_ERROR sin llamar al servicio', async (payload) => {
    const response = await request(app.getHttpServer()).post('/api/turnos').send(payload).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(creation.create).not.toHaveBeenCalled();
  });

  it('publica el código y los detalles de dominio mediante el filtro de C-01', async () => {
    creation.create.mockRejectedValueOnce(
      new AppointmentError('APPOINTMENT_CONFLICT', 'El sillón ya está ocupado en ese horario', HttpStatus.CONFLICT, {
        alcance: 'SILLON',
        conflictos: [],
      }),
    );
    const response = await request(app.getHttpServer()).post('/api/turnos').send(body).expect(409);
    expect(response.body.error).toMatchObject({
      code: 'APPOINTMENT_CONFLICT',
      message: 'El sillón ya está ocupado en ese horario',
      details: { alcance: 'SILLON', conflictos: [] },
    });
  });

  it('no expone otras operaciones sobre turnos', async () => {
    await request(app.getHttpServer()).get('/api/turnos').expect(404);
    await request(app.getHttpServer()).delete('/api/turnos/turno-ficticio').expect(404);
  });
});
