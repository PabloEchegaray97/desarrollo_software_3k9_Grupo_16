import { jest } from '@jest/globals';
import { Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ApiExceptionFilter } from '../../../shared/http/api-exception.filter.js';
import { AvailabilityModule } from '../../availability/availability.module.js';
import { CatalogsModule } from '../../catalogs/catalogs.module.js';
import { AppointmentCoreModule } from '../core/appointment-core.module.js';
import type { AppointmentStatus } from '../core/domain/appointment-status.js';
import { AppointmentLifecycleModule } from './appointment-lifecycle.module.js';
import type { AppointmentLifecycleResponse } from './dto/appointment-lifecycle-response.js';
import { appointmentNotFound, invalidTransition, scheduleConflict, tooEarly } from './lifecycle-errors.js';
import { AppointmentsLifecycleController } from './appointments-lifecycle.controller.js';
import { CancelAppointmentService } from './cancel-appointment.service.js';
import { ChangeAppointmentStatusService } from './change-appointment-status.service.js';
import { RescheduleAppointmentService } from './reschedule-appointment.service.js';

const ID = 'e1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d';
const START = new Date('2027-03-10T13:00:00.000Z');
const BLOCK_END = new Date('2027-03-10T13:40:00.000Z');

function response(estado: AppointmentStatus = 'PROGRAMADO'): AppointmentLifecycleResponse {
  return {
    turno: {
      id: ID,
      pacienteId: '3d2a0c74-9f20-4da0-9f5c-4b3e7a8c9d02',
      prestacionId: '1b0f8a52-7d0e-4b8e-9d3a-2f1c5e6a7b80',
      sillonId: '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91',
      estado,
      inicio: START.toISOString(),
      finAtencion: new Date(START.getTime() + 30 * 60_000).toISOString(),
      finBloqueo: BLOCK_END.toISOString(),
      duracionMinutos: 30,
      intervaloPosteriorMinutos: 10,
      fueraDisponibilidad: false,
      motivoExcepcion: null,
      createdAt: '2027-03-01T10:00:00.000Z',
      motivoCancelacion: null,
      updatedAt: '2027-03-01T10:00:00.000Z',
    },
    historial: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        tipo: 'CREADO',
        ocurridoEn: '2027-03-01T10:00:00.000Z',
        estadoAnterior: null,
        estadoNuevo: 'PROGRAMADO',
        inicioAnterior: null,
        inicioNuevo: START.toISOString(),
        sillonAnteriorId: null,
        sillonNuevoId: '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91',
        motivo: null,
      },
    ],
  };
}

describe('AppointmentsLifecycleController (sin base de datos)', () => {
  let app: INestApplication<App>;
  const reschedule = { reschedule: jest.fn(async () => response()) };
  const cancel = { cancel: jest.fn(async () => response('CANCELADO')) };
  const status = { changeStatus: jest.fn(async () => response('CONFIRMADO')) };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [AppointmentsLifecycleController],
      providers: [
        { provide: RescheduleAppointmentService, useValue: reschedule },
        { provide: CancelAppointmentService, useValue: cancel },
        { provide: ChangeAppointmentStatusService, useValue: status },
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

  const rescheduleBody = {
    fecha: '2027-03-12',
    horaInicio: '10:00',
    motivo: 'Motivo ficticio',
  };

  it('reprograma con 200 y entrega el motivo normalizado al servicio', async () => {
    const result = await request(app.getHttpServer())
      .patch(`/api/turnos/${ID}/reprogramar`)
      .send({ ...rescheduleBody, motivo: '  Motivo   ficticio  ' })
      .expect(200);

    expect(reschedule.reschedule).toHaveBeenCalledWith(ID, expect.objectContaining({ motivo: 'Motivo ficticio' }));
    expect(result.body).toEqual(response());
  });

  it('cancela con 200 y cambia el estado con 200', async () => {
    const cancelled = await request(app.getHttpServer())
      .patch(`/api/turnos/${ID}/cancelar`)
      .send({ motivo: '  Cancelación ficticia  ' })
      .expect(200);
    expect(cancel.cancel).toHaveBeenCalledWith(ID, expect.objectContaining({ motivo: 'Cancelación ficticia' }));
    expect(cancelled.body.turno.estado).toBe('CANCELADO');

    const changed = await request(app.getHttpServer())
      .patch(`/api/turnos/${ID}/estado`)
      .send({ estado: 'CONFIRMADO' })
      .expect(200);
    expect(status.changeStatus).toHaveBeenCalledWith(ID, expect.objectContaining({ estado: 'CONFIRMADO' }));
    expect(changed.body).toEqual(response('CONFIRMADO'));

    status.changeStatus.mockResolvedValueOnce(response('AUSENTE'));
    const absent = await request(app.getHttpServer())
      .patch(`/api/turnos/${ID}/estado`)
      .send({ estado: 'AUSENTE' })
      .expect(200);
    expect(status.changeStatus).toHaveBeenLastCalledWith(ID, expect.objectContaining({ estado: 'AUSENTE' }));
    expect(absent.body.turno.estado).toBe('AUSENTE');
  });

  it.each([
    ['reprogramar', {}],
    ['reprogramar', { ...rescheduleBody, motivo: '   ' }],
    ['reprogramar', { ...rescheduleBody, horaInicio: '25:00' }],
    ['cancelar', {}],
    ['cancelar', { motivo: '   ' }],
    ['estado', { estado: 'CANCELADO' }],
    ['estado', { estado: 'PROGRAMADO' }],
    ['estado', { estado: 'DESCONOCIDO' }],
  ])('rechaza %s con %p y 400 sin llamar a ningún servicio', async (operation, body) => {
    await request(app.getHttpServer()).patch(`/api/turnos/${ID}/${operation}`).send(body).expect(400);
    expect(reschedule.reschedule).not.toHaveBeenCalled();
    expect(cancel.cancel).not.toHaveBeenCalled();
    expect(status.changeStatus).not.toHaveBeenCalled();
  });

  it('publica 404 para un turno inexistente', async () => {
    reschedule.reschedule.mockRejectedValueOnce(appointmentNotFound());

    const result = await request(app.getHttpServer()).patch(`/api/turnos/${ID}/reprogramar`).send(rescheduleBody).expect(404);

    expect(result.body.error).toMatchObject({ code: 'APPOINTMENT_NOT_FOUND', message: 'El turno no existe' });

    cancel.cancel.mockRejectedValueOnce(appointmentNotFound());
    const cancelled = await request(app.getHttpServer()).patch(`/api/turnos/${ID}/cancelar`).send({ motivo: 'Ficticio' }).expect(404);
    expect(cancelled.body.error.code).toBe('APPOINTMENT_NOT_FOUND');
  });

  it('publica 409 para transiciones inválidas y conflictos sin datos de paciente', async () => {
    cancel.cancel.mockRejectedValueOnce(invalidTransition('ATENDIDO', 'CANCELAR'));
    const transition = await request(app.getHttpServer()).patch(`/api/turnos/${ID}/cancelar`).send({ motivo: 'Ficticio' }).expect(409);
    expect(transition.body.error).toMatchObject({
      code: 'APPOINTMENT_INVALID_TRANSITION',
      details: { estadoActual: 'ATENDIDO', operacion: 'CANCELAR' },
    });

    reschedule.reschedule.mockRejectedValueOnce(
      scheduleConflict({
        scope: 'SILLON',
        conflicts: [
          {
            id: 'b1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6e',
            chairId: '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91',
            status: 'PROGRAMADO',
            startsAt: START,
            blockEndsAt: BLOCK_END,
          },
        ],
      }),
    );
    const conflict = await request(app.getHttpServer()).patch(`/api/turnos/${ID}/reprogramar`).send(rescheduleBody).expect(409);
    expect(conflict.body.error).toMatchObject({ code: 'APPOINTMENT_CONFLICT', details: { alcance: 'SILLON' } });
    expect(Object.keys(conflict.body.error.details.conflictos[0]).sort()).toEqual([
      'finBloqueo',
      'inicio',
      'sillonId',
      'turnoId',
    ]);
    const serialized = JSON.stringify([transition.body, conflict.body]);
    for (const privateField of ['pacienteId', 'prestacionId', 'nombre', 'telefono', 'dni', 'correo', 'diagnostico']) {
      expect(serialized).not.toContain(privateField);
    }
  });

  it('publica 422 con instantes UTC cuando el servicio rechaza la ventana temporal', async () => {
    status.changeStatus.mockRejectedValueOnce(tooEarly(START, new Date(START.getTime() - 1)));

    const result = await request(app.getHttpServer()).patch(`/api/turnos/${ID}/estado`).send({ estado: 'ATENDIDO' }).expect(422);

    expect(result.body.error).toMatchObject({
      code: 'APPOINTMENT_TOO_EARLY',
      details: { inicio: START.toISOString(), ahora: new Date(START.getTime() - 1).toISOString() },
    });
  });
});

describe('AppointmentLifecycleModule (composición)', () => {
  it('importa el núcleo, disponibilidad y catálogos, y registra el controlador y los tres servicios', () => {
    const imports = Reflect.getMetadata('imports', AppointmentLifecycleModule) as readonly unknown[];
    const controllers = Reflect.getMetadata('controllers', AppointmentLifecycleModule) as readonly unknown[];
    const providers = Reflect.getMetadata('providers', AppointmentLifecycleModule) as readonly unknown[];

    expect(imports).toEqual(expect.arrayContaining([AppointmentCoreModule, AvailabilityModule, CatalogsModule]));
    expect(controllers).toContain(AppointmentsLifecycleController);
    expect(providers).toEqual(
      expect.arrayContaining([RescheduleAppointmentService, CancelAppointmentService, ChangeAppointmentStatusService]),
    );
  });
});
