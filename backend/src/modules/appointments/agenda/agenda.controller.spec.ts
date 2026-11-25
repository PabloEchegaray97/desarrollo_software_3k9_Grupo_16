import { jest } from '@jest/globals';
import { Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ApiExceptionFilter } from '../../../shared/http/api-exception.filter.js';
import { chairNotFound, rangeInvalid, rangeTooLarge } from './agenda-errors.js';
import type { AgendaResponse } from './agenda-response.js';
import { AgendaController } from './agenda.controller.js';
import { AgendaService } from './agenda.service.js';

const CHAIR_ID = '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91';
const EMPTY: AgendaResponse = {
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  desde: '2027-03-10',
  hasta: '2027-03-10',
  generadoEn: '2027-03-01T12:00:00.000Z',
  turnos: [],
  dias: [{ fecha: '2027-03-10', tramos: [], bloqueos: [] }],
};

describe('AgendaController (sin base de datos)', () => {
  let app: INestApplication<App>;
  const agenda = { consultar: jest.fn(async (_query: unknown): Promise<AgendaResponse> => EMPTY) };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [AgendaController],
      providers: [{ provide: AgendaService, useValue: agenda }],
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

  beforeEach(() => agenda.consultar.mockClear());

  it('responde 200 con el cuerpo del servicio', async () => {
    const response = await request(app.getHttpServer()).get('/api/agenda?desde=2027-03-10').expect(200);
    expect(response.body).toEqual(EMPTY);
    expect(agenda.consultar).toHaveBeenCalledWith(expect.objectContaining({ desde: '2027-03-10' }));
  });

  it('entrega los filtros ya convertidos al servicio', async () => {
    await request(app.getHttpServer()).get(`/api/agenda?desde=2027-03-10&hasta=2027-03-12&sillonId=${CHAIR_ID}&estado=PROGRAMADO,CONFIRMADO`).expect(200);
    expect(agenda.consultar).toHaveBeenCalledWith(
      expect.objectContaining({ hasta: '2027-03-12', sillonId: CHAIR_ID, estado: ['PROGRAMADO', 'CONFIRMADO'] }),
    );
  });

  it.each([
    '/api/agenda',
    '/api/agenda?desde=10/03/2027',
    '/api/agenda?desde=2027-03-10&hasta=mañana',
    '/api/agenda?desde=2027-03-10&sillonId=abc',
    '/api/agenda?desde=2027-03-10&estado=PENDIENTE',
    '/api/agenda?desde=2027-03-10&estado=',
    '/api/agenda?desde=2027-03-10&pagina=2',
  ])('rechaza %s con 400 VALIDATION_ERROR sin llamar al servicio', async (url) => {
    const response = await request(app.getHttpServer()).get(url).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(agenda.consultar).not.toHaveBeenCalled();
  });

  it('publica el código y los detalles de un rango excesivo', async () => {
    agenda.consultar.mockRejectedValueOnce(rangeTooLarge(32));
    const response = await request(app.getHttpServer()).get('/api/agenda?desde=2027-03-01&hasta=2027-04-01').expect(400);
    expect(response.body.error).toMatchObject({ code: 'AGENDA_RANGE_TOO_LARGE', details: { maximoDias: 31, solicitadoDias: 32 } });
  });

  it('publica 400 AGENDA_RANGE_INVALID y 422 AGENDA_CHAIR_NOT_FOUND', async () => {
    agenda.consultar.mockRejectedValueOnce(rangeInvalid());
    const invalid = await request(app.getHttpServer()).get('/api/agenda?desde=2027-03-12&hasta=2027-03-10').expect(400);
    expect(invalid.body.error.code).toBe('AGENDA_RANGE_INVALID');

    agenda.consultar.mockRejectedValueOnce(chairNotFound());
    const missing = await request(app.getHttpServer()).get(`/api/agenda?desde=2027-03-10&sillonId=${CHAIR_ID}`).expect(422);
    expect(missing.body.error).toMatchObject({ code: 'AGENDA_CHAIR_NOT_FOUND', details: { campo: 'sillonId', motivo: 'INEXISTENTE' } });
  });
});
