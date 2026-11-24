import type { Response } from 'supertest';
import {
  api,
  clearAppointments,
  seedFixtures,
  startAppointmentApi,
  stopAppointmentApi,
  storedStartsAt,
  type AppointmentApiContext,
  type Fixtures,
} from './testing/appointment-api.support-spec.js';

/** Miércoles con tramo 09:00–13:00 (UTC−03:00): 10:00 local = 13:00Z. */
const WEDNESDAY = '2027-03-10';
/** Miércoles con feriado de día completo. */
const HOLIDAY = '2027-03-17';

interface AppointmentBody {
  id: string;
  estado: string;
  inicio: string;
  finAtencion: string;
  finBloqueo: string;
  duracionMinutos: number;
  intervaloPosteriorMinutos: number;
  fueraDisponibilidad: boolean;
  motivoExcepcion: string | null;
}

interface ErrorBody {
  error: { code: string; message: string; requestId: string; details?: Record<string, unknown> };
}

describe('Alta de turnos (integración MariaDB)', () => {
  let context: AppointmentApiContext | undefined;
  let fx: Fixtures;
  const http = () => api(context!);
  const db = () => context!.db;

  const book = (overrides: Record<string, unknown> = {}) =>
    http().post('/turnos', {
      pacienteId: fx.patientId,
      prestacionId: fx.procedureId,
      sillonId: fx.chair1Id,
      fecha: WEDNESDAY,
      horaInicio: '10:00',
      ...overrides,
    });

  const created = async (overrides: Record<string, unknown> = {}): Promise<AppointmentBody> => {
    const response = await book(overrides);
    expect(response.status).toBe(201);
    return response.body as AppointmentBody;
  };

  const errorOf = (response: Response) => (response.body as ErrorBody).error;

  const expectError = (response: Response, status: number, code: string) => {
    expect(response.status).toBe(status);
    expect(typeof errorOf(response).requestId).toBe('string');
    expect(errorOf(response).code).toBe(code);
  };

  const events = async (appointmentId: string) =>
    (await db().query(
      'SELECT type, new_status AS newStatus, reason, DATE_FORMAT(occurred_at, "%Y-%m-%dT%H:%i:%s") AS occurredAt FROM appointment_events WHERE appointment_id = ? ORDER BY type',
      [appointmentId],
    )) as Array<{ type: string; newStatus: string | null; reason: string | null; occurredAt: string }>;

  const appointmentCount = async () => Number(((await db().query('SELECT COUNT(*) AS total FROM appointments')) as Array<{ total: string }>)[0]?.total);

  beforeAll(async () => {
    context = await startAppointmentApi();
    fx = await seedFixtures(context);
  });

  afterAll(async () => {
    await stopAppointmentApi(context);
  });

  beforeEach(async () => {
    await clearAppointments(db());
    await db().query('DELETE FROM excepcion_disponibilidad');
    await db().query("UPDATE configuracion_agenda SET intervalo_global_minutos = 10 WHERE id = '00000000-0000-4000-8000-000000000001'");
  });

  describe('reglas de alta', () => {
    it('requiere sesión', async () => {
      const response = await http().anonymousPost('/turnos', {});
      expect(response.status).toBe(401);
      expect(await appointmentCount()).toBe(0);
    });

    it('crea un turno ordinario con tiempos efectivos persistidos y un evento CREADO', async () => {
      const appointment = await created();

      expect(appointment).toMatchObject({
        estado: 'PROGRAMADO',
        inicio: '2027-03-10T13:00:00.000Z',
        finAtencion: '2027-03-10T13:30:00.000Z',
        finBloqueo: '2027-03-10T13:40:00.000Z',
        duracionMinutos: 30,
        intervaloPosteriorMinutos: 10,
        fueraDisponibilidad: false,
        motivoExcepcion: null,
      });
      expect(await events(appointment.id)).toEqual([
        { type: 'CREADO', newStatus: 'PROGRAMADO', reason: null, occurredAt: '2027-03-01T12:00:00' },
      ]);
    });

    it('aplica la precedencia turno → prestación → global', async () => {
      await db().query("UPDATE configuracion_agenda SET intervalo_global_minutos = 20 WHERE id = '00000000-0000-4000-8000-000000000001'");
      const global = await created({ horaInicio: '09:00' });
      const fromProcedure = await created({ prestacionId: fx.procedureWithIntervalId, horaInicio: '10:00' });
      const overridden = await created({ horaInicio: '11:00', duracionMinutos: 50, intervaloPosteriorMinutos: 0 });

      expect([global.duracionMinutos, global.intervaloPosteriorMinutos]).toEqual([30, 20]);
      expect([fromProcedure.duracionMinutos, fromProcedure.intervaloPosteriorMinutos]).toEqual([30, 5]);
      expect([overridden.duracionMinutos, overridden.intervaloPosteriorMinutos, overridden.finBloqueo]).toEqual([50, 0, '2027-03-10T14:50:00.000Z']);
    });

    it('cambios posteriores de la prestación o del global no reescriben el turno', async () => {
      const appointment = await created();
      await http().put(`/prestaciones/${fx.procedureId}`, { nombre: 'Prestación ficticia C05 sin intervalo', duracionPredeterminadaMinutos: 90 }).expect(200);
      await db().query("UPDATE configuracion_agenda SET intervalo_global_minutos = 30 WHERE id = '00000000-0000-4000-8000-000000000001'");

      const rows = (await db().query('SELECT duration_minutes AS d, post_interval_minutes AS i FROM appointments WHERE id = ?', [appointment.id])) as Array<{ d: number; i: number }>;
      expect(rows).toEqual([{ d: 30, i: 10 }]);
      await http().put(`/prestaciones/${fx.procedureId}`, { nombre: 'Prestación ficticia C05 sin intervalo', duracionPredeterminadaMinutos: 30 }).expect(200);
    });

    it('permite un turno que comienza exactamente en el finBloqueo anterior, en cualquier sillón', async () => {
      await created();
      await created({ horaInicio: '10:40', sillonId: fx.chair2Id });
      await created({ horaInicio: '11:20' });
    });

    it('rechaza comenzar dentro del intervalo posterior y un bloqueo que alcanza al siguiente', async () => {
      await created({ horaInicio: '11:00' });

      expectError(await book({ horaInicio: '11:35' }), 409, 'APPOINTMENT_CONFLICT');
      expectError(await book({ horaInicio: '10:30', intervaloPosteriorMinutos: 5 }), 409, 'APPOINTMENT_CONFLICT');
      expect(await appointmentCount()).toBe(1);
    });

    it('informa el alcance ODONTOLOGO en otro sillón y SILLON en el mismo, sin datos del paciente', async () => {
      const existing = await created();

      const otherChair = await book({ horaInicio: '10:15', sillonId: fx.chair2Id });
      const sameChair = await book({ horaInicio: '10:15' });

      expectError(otherChair, 409, 'APPOINTMENT_CONFLICT');
      expect(errorOf(otherChair).details).toEqual({
        alcance: 'ODONTOLOGO',
        conflictos: [{ turnoId: existing.id, sillonId: fx.chair1Id, inicio: existing.inicio, finBloqueo: existing.finBloqueo }],
      });
      expectError(sameChair, 409, 'APPOINTMENT_CONFLICT');
      expect(errorOf(sameChair).details?.alcance).toBe('SILLON');
      expect(JSON.stringify(errorOf(sameChair))).not.toMatch(/Paciente Ficticio|5555/);
    });

    it.each(['ATENDIDO', 'AUSENTE', 'CONFIRMADO'])('un turno %s sigue bloqueando', async (status) => {
      const existing = await created();
      await db().query('UPDATE appointments SET status = ? WHERE id = ?', [status, existing.id]);
      expectError(await book({ horaInicio: '10:15' }), 409, 'APPOINTMENT_CONFLICT');
    });

    it('un turno CANCELADO libera el horario', async () => {
      const existing = await created();
      await db().query("UPDATE appointments SET status = 'CANCELADO', cancellation_reason = 'Cancelación ficticia' WHERE id = ?", [existing.id]);
      await created();
    });
  });

  describe('disponibilidad y excepción', () => {
    it('fuera de horario sin confirmación → 409 y no guarda', async () => {
      const response = await book({ horaInicio: '18:00' });
      expectError(response, 409, 'APPOINTMENT_OUTSIDE_AVAILABILITY');
      expect(errorOf(response).details).toEqual({ requiereOverrideManual: true, inicio: '2027-03-10T21:00:00.000Z', finAtencion: '2027-03-10T21:30:00.000Z' });
      expect(await appointmentCount()).toBe(0);
    });

    it('fuera de horario con motivo → turno de excepción y eventos CREADO + EXCEPCION', async () => {
      const appointment = await created({ horaInicio: '18:00', fueraDisponibilidad: true, motivoExcepcion: '  Urgencia ficticia  ' });

      expect(appointment).toMatchObject({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' });
      expect((await events(appointment.id)).map((event) => [event.type, event.reason])).toEqual([
        ['CREADO', null],
        ['EXCEPCION', 'Urgencia ficticia'],
      ]);
    });

    it('override sin motivo → 400 VALIDATION_ERROR', async () => {
      expectError(await book({ horaInicio: '18:00', fueraDisponibilidad: true }), 400, 'VALIDATION_ERROR');
      expectError(await book({ horaInicio: '18:00', fueraDisponibilidad: true, motivoExcepcion: '   ' }), 400, 'VALIDATION_ERROR');
    });

    it('el override no exceptúa un conflicto', async () => {
      await created({ horaInicio: '18:00', fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' });
      expectError(
        await book({ horaInicio: '18:10', sillonId: fx.chair2Id, fueraDisponibilidad: true, motivoExcepcion: 'Otra urgencia ficticia' }),
        409,
        'APPOINTMENT_CONFLICT',
      );
    });

    it('un día con FERIADO se rechaza aun con override', async () => {
      await http().post('/disponibilidad/excepciones', { fecha: HOLIDAY, tipo: 'FERIADO', motivo: 'Feriado ficticio' }).expect(201);

      for (const extra of [{}, { fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' }]) {
        const response = await book({ fecha: HOLIDAY, ...extra });
        expectError(response, 409, 'APPOINTMENT_BLOCKED_BY_EXCEPTION');
        expect(errorOf(response).details).toEqual({ tipoExcepcion: 'FERIADO', motivoExcepcion: 'Feriado ficticio' });
      }
      expect(await appointmentCount()).toBe(0);
    });

    it('un override innecesario se guarda como turno ordinario', async () => {
      const appointment = await created({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' });
      expect(appointment).toMatchObject({ fueraDisponibilidad: false, motivoExcepcion: null });
      expect((await events(appointment.id)).map((event) => event.type)).toEqual(['CREADO']);
    });

    it('rechaza referencias inexistentes o inactivas indicando el campo', async () => {
      expect(errorOf(await book({ pacienteId: '00000000-0000-4000-8000-0000000000ff' })).details).toEqual({ campo: 'pacienteId', motivo: 'INEXISTENTE' });

      await http().patch(`/sillones/${fx.chair2Id}/estado`, { activo: false }).expect(200);
      const inactive = await book({ sillonId: fx.chair2Id });
      await http().patch(`/sillones/${fx.chair2Id}/estado`, { activo: true }).expect(200);

      expectError(inactive, 422, 'APPOINTMENT_REFERENCE_INVALID');
      expect(errorOf(inactive).details).toEqual({ campo: 'sillonId', motivo: 'INACTIVO' });
    });

    it('rechaza un inicio pasado según el reloj del servidor', async () => {
      context!.clock.set(new Date('2027-03-10T15:00:00.000Z'));
      try {
        expectError(await book({ horaInicio: '11:00' }), 422, 'APPOINTMENT_IN_PAST');
        await created({ horaInicio: '12:00' });
      } finally {
        context!.clock.set(new Date('2027-03-01T12:00:00.000Z'));
      }
    });

    it('rechaza una fecha local inexistente', async () => {
      expectError(await book({ fecha: '2027-02-30' }), 400, 'APPOINTMENT_INVALID_TIME');
    });
  });

  describe('concurrencia y atomicidad', () => {
    it.each([
      ['dos altas en el mismo sillón', 2, false],
      ['dos altas en sillones distintos', 2, true],
      ['cinco altas en el mismo sillón', 5, false],
      ['cinco altas en sillones alternados', 5, true],
    ])('%s: exactamente una se completa', async (_label, count, alternateChairs) => {
      const responses = await Promise.all(
        Array.from({ length: count }, (_value, index) =>
          book({
            horaInicio: `10:0${index}`,
            sillonId: alternateChairs && index % 2 === 1 ? fx.chair2Id : fx.chair1Id,
          }),
        ),
      );
      const statuses = responses.map((response) => response.status).sort((left, right) => left - right);

      expect(statuses).toEqual([201, ...Array.from({ length: count - 1 }, () => 409)]);
      for (const rejected of responses.filter((response) => response.status === 409)) {
        expect(errorOf(rejected).code).toBe('APPOINTMENT_CONFLICT');
      }
      expect(await appointmentCount()).toBe(1);
    });

    it('si falla el historial no queda ni el turno ni el evento', async () => {
      context!.writer.failNextEvents = true;

      const response = await book();

      expect(response.status).toBe(500);
      expect(errorOf(response).code).toBe('INTERNAL_ERROR');
      expect(await appointmentCount()).toBe(0);
      expect(Number(((await db().query('SELECT COUNT(*) AS total FROM appointment_events')) as Array<{ total: string }>)[0]?.total)).toBe(0);
      await created();
    });
  });

  describe('instantes UTC', () => {
    /**
     * Debe pasar con cualquier zona del proceso (RN-TI-02, regla dura 4). Hoy solo pasa con
     * `TZ=UTC`: sin `timezone: 'Z'` en `data-source.ts` (CR-05-01, superficie de C-01), mysql2
     * serializa en la zona del proceso. Reproducir con:
     *   TZ=America/Argentina/Buenos_Aires npm run test:integration
     * La zona se fija al arrancar el proceso: cambiar `process.env.TZ` dentro de Jest no tiene efecto.
     */
    it(`guarda el instante UTC literal (zona del proceso: ${Intl.DateTimeFormat().resolvedOptions().timeZone})`, async () => {
      const appointment = await created();
      expect(appointment.inicio).toBe('2027-03-10T13:00:00.000Z');
      expect(await storedStartsAt(db(), appointment.id)).toBe('2027-03-10 13:00:00');
    });
  });
});
