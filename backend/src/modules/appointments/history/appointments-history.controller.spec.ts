import { jest } from '@jest/globals';
import { Logger, ValidationPipe, type CanActivate, type ExecutionContext, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { ApiExceptionFilter } from '../../../shared/http/api-exception.filter.js';
import { sessionRequired } from '../../auth/auth-errors.js';
import { AppointmentWriter } from '../core/database/appointment-writer.js';
import { APPOINTMENT_TRANSACTION_BOUNDARY } from '../core/database/typeorm-transaction-boundary.js';
import { AppointmentCoreModule } from '../core/appointment-core.module.js';
import { AppointmentHistoryModule } from './appointment-history.module.js';
import { AppointmentsHistoryController } from './appointments-history.controller.js';
import type { AppointmentHistoryResponse } from './dto/appointment-history-response.js';
import { appointmentNotFound } from './history-errors.js';
import { GetAppointmentHistoryService } from './get-appointment-history.service.js';

const TURNO_ID = 'c6b00001-0000-4000-8000-000000000001';
const CHAIR_ID = 'c6b00002-0000-4000-8000-000000000002';
const COOKIE = 'session=ficticia-para-prueba';
const EVENT_KEYS = [
  'estadoAnterior',
  'estadoNuevo',
  'id',
  'inicioAnterior',
  'inicioNuevo',
  'motivo',
  'ocurridoEn',
  'sillonAnteriorId',
  'sillonNuevoId',
  'tipo',
];

function history(): AppointmentHistoryResponse {
  return {
    turnoId: TURNO_ID,
    eventos: [
      {
        id: 'c6b00011-0000-4000-8000-000000000011',
        tipo: 'CREADO',
        ocurridoEn: '2027-03-01T10:00:00.000Z',
        estadoAnterior: null,
        estadoNuevo: 'PROGRAMADO',
        inicioAnterior: null,
        inicioNuevo: '2027-03-10T13:00:00.000Z',
        sillonAnteriorId: null,
        sillonNuevoId: CHAIR_ID,
        motivo: null,
      },
      {
        id: 'c6b00012-0000-4000-8000-000000000012',
        tipo: 'REPROGRAMADO',
        ocurridoEn: '2027-03-02T10:00:00.000Z',
        estadoAnterior: 'CONFIRMADO',
        estadoNuevo: 'PROGRAMADO',
        inicioAnterior: '2027-03-10T13:00:00.000Z',
        inicioNuevo: '2027-03-12T09:00:00.000Z',
        sillonAnteriorId: CHAIR_ID,
        sillonNuevoId: null,
        motivo: 'Motivo ficticio de reprogramación',
      },
    ],
  };
}

/** Simula el guard global de C-04 sin base: solo requiere presencia de cookie. */
const sessionGuard: CanActivate = {
  canActivate: (context: ExecutionContext) => {
    const httpRequest = context.switchToHttp().getRequest<{ headers: { cookie?: string } }>();
    if (!httpRequest.headers.cookie) throw sessionRequired();
    return true;
  },
};

describe('AppointmentsHistoryController (sin base de datos)', () => {
  let app: INestApplication<App>;
  const getHistory = jest.fn(async (_id: string): Promise<AppointmentHistoryResponse> => history());
  const service = { getHistory };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [AppointmentsHistoryController],
      providers: [
        { provide: GetAppointmentHistoryService, useValue: service },
        { provide: APP_GUARD, useValue: sessionGuard },
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

  it('devuelve 200 con el DTO exacto y sin identidad ni datos clínicos', async () => {
    const result = await request(app.getHttpServer())
      .get(`/api/turnos/${TURNO_ID}/historial`)
      .set('Cookie', COOKIE)
      .expect(200);

    expect(getHistory).toHaveBeenCalledWith(TURNO_ID);
    expect(result.body).toEqual(history());
    expect(Object.keys(result.body).sort()).toEqual(['eventos', 'turnoId']);
    for (const item of result.body.eventos as Array<Record<string, unknown>>) {
      expect(Object.keys(item).sort()).toEqual(EVENT_KEYS);
    }
    const serialized = JSON.stringify(result.body);
    for (const forbidden of [
      'pacienteId',
      'patientId',
      'prestacionId',
      'procedureId',
      'nombre',
      'telefono',
      'dni',
      'correo',
      'diagnostico',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('devuelve 401 sin sesión y no consulta el historial', async () => {
    const result = await request(app.getHttpServer()).get(`/api/turnos/${TURNO_ID}/historial`).expect(401);

    expect(getHistory).not.toHaveBeenCalled();
    expect(result.body.error).toMatchObject({ code: 'HTTP_401' });
    expect(result.body).not.toHaveProperty('eventos');
  });

  it('devuelve 404 con el código neutral para un turno inexistente', async () => {
    getHistory.mockRejectedValueOnce(appointmentNotFound());

    const result = await request(app.getHttpServer())
      .get(`/api/turnos/${TURNO_ID}/historial`)
      .set('Cookie', COOKIE)
      .expect(404);

    expect(getHistory).toHaveBeenCalledWith(TURNO_ID);
    expect(result.body.error).toMatchObject({ code: 'APPOINTMENT_NOT_FOUND', message: 'El turno no existe' });
    expect(result.body).not.toHaveProperty('eventos');
    expect(JSON.stringify(result.body)).not.toContain('paciente');
  });
});

describe('AppointmentHistoryModule (composición)', () => {
  it('importa el núcleo y registra el controlador y el servicio de consulta', () => {
    const imports = Reflect.getMetadata('imports', AppointmentHistoryModule) as readonly unknown[];
    const controllers = Reflect.getMetadata('controllers', AppointmentHistoryModule) as readonly unknown[];
    const providers = Reflect.getMetadata('providers', AppointmentHistoryModule) as readonly unknown[];

    expect(imports).toContain(AppointmentCoreModule);
    expect(controllers).toContain(AppointmentsHistoryController);
    expect(providers).toContain(GetAppointmentHistoryService);
  });

  it('resuelve el controlador y el servicio por DI sin editar la composición global', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppointmentHistoryModule] })
      .overrideProvider(DataSource)
      .useValue({ isInitialized: false })
      .overrideProvider(APPOINTMENT_TRANSACTION_BOUNDARY)
      .useValue({ run: async <T>(work: () => Promise<T>): Promise<T> => work() })
      .overrideProvider(AppointmentWriter)
      .useValue({ findAppointment: async () => ({ id: TURNO_ID }) })
      .compile();

    expect(moduleRef.get(AppointmentsHistoryController)).toBeInstanceOf(AppointmentsHistoryController);
    expect(moduleRef.get(GetAppointmentHistoryService)).toBeInstanceOf(GetAppointmentHistoryService);
    await moduleRef.close();
  });
});
