/**
 * Integración de C-06 contra MariaDB real (nunca SQLite ni base en memoria).
 * Ejecutar: npm run test:integration
 *
 * Los fixtures son exclusivamente ficticios y se limpian en `afterAll`; los eventos
 * se borran antes que los turnos y estos antes que pacientes/catálogos (FK RESTRICT).
 */
import {
  api,
  clearLifecycleAppointments,
  countAppointments,
  countAppointmentEvents,
  seedLifecycleFixtures,
  startLifecycleApi,
  storedAppointmentRow,
  storedEventIdsInOrder,
  storedEventRows,
  storedStartsAt,
  stopLifecycleApi,
  type LifecycleApiContext,
  type LifecycleFixtures,
} from './testing/appointment-lifecycle-api.support-spec.js';

describe('API de ciclo de vida (integración MariaDB)', () => {
  let context: LifecycleApiContext | undefined;
  let fx: LifecycleFixtures;
  const db = () => context!.db;
  const http = () => api(context!);

  interface AppointmentBody {
    id: string;
    estado: string;
    inicio: string;
    finAtencion: string;
    finBloqueo: string;
    sillonId: string;
    motivoCancelacion: string | null;
    fueraDisponibilidad: boolean;
    motivoExcepcion: string | null;
  }

  interface LifecycleBody {
    turno: AppointmentBody;
    historial: Array<{
      id: string;
      tipo: string;
      ocurridoEn: string;
      estadoAnterior: string | null;
      estadoNuevo: string | null;
      inicioAnterior: string | null;
      inicioNuevo: string | null;
      sillonAnteriorId: string | null;
      sillonNuevoId: string | null;
      motivo: string | null;
    }>;
  }

  interface ErrorBody {
    error: { code: string; message: string; details?: Record<string, unknown> };
  }

  const book = (overrides: Record<string, unknown> = {}) =>
    http().post('/turnos', {
      pacienteId: fx.patientId,
      prestacionId: fx.procedureId,
      sillonId: fx.chair1Id,
      fecha: '2027-03-10',
      horaInicio: '10:00',
      ...overrides,
    });

  const created = async (overrides: Record<string, unknown> = {}): Promise<AppointmentBody> => {
    const response = await book(overrides);
    expect(response.status).toBe(201);
    return response.body as AppointmentBody;
  };

  const errorOf = (response: { body: unknown }) => (response.body as ErrorBody).error;

  const expectError = (response: { status: number; body: unknown }, status: number, code: string) => {
    expect(response.status).toBe(status);
    expect(errorOf(response).code).toBe(code);
  };

  const reschedule = (id: string, body: object) => http().patch(`/turnos/${id}/reprogramar`, body);
  const cancel = (id: string, motivo: string) => http().patch(`/turnos/${id}/cancelar`, { motivo });
  const changeStatus = (id: string, estado: string) => http().patch(`/turnos/${id}/estado`, { estado });

  beforeAll(async () => {
    context = await startLifecycleApi();
    fx = await seedLifecycleFixtures(context);
  });

  afterAll(async () => {
    await stopLifecycleApi(context);
  });

  beforeEach(async () => {
    await clearLifecycleAppointments(db());
    await db().query('DELETE FROM excepcion_disponibilidad');
    context!.clock.set(new Date('2027-03-01T12:00:00.000Z'));
  });

  describe('harness (4.1)', () => {
    it('arranca contra MariaDB real y siembra solo fixtures ficticios', async () => {
      expect((db().options as { type: string }).type).toBe('mariadb');
      const versionRows = (await db().query('SELECT VERSION() AS version')) as Array<{ version: string }>;
      expect(versionRows[0]?.version).toMatch(/mariadb/i);
      console.log(`[C-06] MariaDB real: ${versionRows[0]?.version}`);

      const patientRows = (await db().query('SELECT name FROM patients WHERE id = ?', [fx.patientId])) as Array<{
        name: string;
      }>;
      expect(patientRows).toEqual([{ name: 'Paciente Ficticio C06 Uno' }]);
      const chairRows = (await db().query('SELECT name FROM chairs WHERE id IN (?, ?) ORDER BY name', [
        fx.chair1Id,
        fx.chair2Id,
      ])) as Array<{ name: string }>;
      expect(chairRows.map((row) => row.name)).toEqual(['Sillón ficticio C06 A', 'Sillón ficticio C06 B']);
    });

    it('respeta la FK RESTRICT: sin borrar eventos y turnos no se puede borrar el paciente', async () => {
      const extraPatientResponse = await http().post('/pacientes', {
        nombre: 'Paciente Ficticio C06 FK Restrict',
        telefono: '11 5555-0602',
        confirmarPosibleDuplicado: true,
      });
      expect(extraPatientResponse.status).toBe(201);
      const extraPatientId = (extraPatientResponse.body as { id: string }).id;
      const appointment = await created({ pacienteId: extraPatientId });

      const eventCount = (await db().query('SELECT COUNT(*) AS total FROM appointment_events WHERE appointment_id = ?', [appointment.id])) as Array<{
        total: string;
      }>;
      expect(Number(eventCount[0]?.total)).toBe(1);

      let constraintCode = '';
      try {
        await db().query('DELETE FROM patients WHERE id = ?', [extraPatientId]);
      } catch (error: unknown) {
        if (error !== null && typeof error === 'object' && 'code' in error) constraintCode = String(error.code);
      }
      expect(constraintCode).toMatch(/ROW_IS_REFERENCED/u);
      const stillThere = (await db().query('SELECT COUNT(*) AS total FROM patients WHERE id = ?', [extraPatientId])) as Array<{
        total: string;
      }>;
      expect(Number(stillThere[0]?.total)).toBe(1);

      await clearLifecycleAppointments(db());
      await db().query('DELETE FROM patients WHERE id = ?', [extraPatientId]);
      const finalCount = (await db().query('SELECT COUNT(*) AS total FROM patients WHERE id = ?', [extraPatientId])) as Array<{
        total: string;
      }>;
      expect(Number(finalCount[0]?.total)).toBe(0);
    });
  });

  describe('aristas permitidas y rechazadas (4.2)', () => {
    it('reprograma sin cambiar de sillón, conserva minutos y registra un REPROGRAMADO', async () => {
      const appointment = await created();
      const original = await storedAppointmentRow(db(), appointment.id);
      expect(original.startsAt).toBe('2027-03-10 13:00:00');

      const response = await http().patch(`/turnos/${appointment.id}/reprogramar`, {
        fecha: '2027-03-10',
        horaInicio: '11:00',
        motivo: '  Motivo   ficticio de reprogramación  ',
      });
      expect(response.status).toBe(200);
      const body = response.body as LifecycleBody;
      expect(body.turno).toMatchObject({
        estado: 'PROGRAMADO',
        inicio: '2027-03-10T14:00:00.000Z',
        finAtencion: '2027-03-10T14:30:00.000Z',
        finBloqueo: '2027-03-10T14:40:00.000Z',
        sillonId: fx.chair1Id,
      });

      expect(await storedAppointmentRow(db(), appointment.id)).toMatchObject({
        status: 'PROGRAMADO',
        startsAt: '2027-03-10 14:00:00',
        careEndsAt: '2027-03-10 14:30:00',
        blockEndsAt: '2027-03-10 14:40:00',
        chairId: fx.chair1Id,
        durationMinutes: 30,
        postIntervalMinutes: 10,
      });
      const events = await storedEventRows(db(), appointment.id);
      expect(events).toHaveLength(2);
      expect(events.filter((event) => event.type === 'CREADO')).toEqual([
        {
          type: 'CREADO',
          previousStatus: null,
          newStatus: 'PROGRAMADO',
          previousStartsAt: null,
          newStartsAt: '2027-03-10 13:00:00',
          previousChairId: null,
          newChairId: fx.chair1Id,
          reason: null,
          occurredAt: '2027-03-01 12:00:00',
        },
      ]);
      expect(events.filter((event) => event.type === 'REPROGRAMADO')).toEqual([
        {
          type: 'REPROGRAMADO',
          previousStatus: 'PROGRAMADO',
          newStatus: 'PROGRAMADO',
          previousStartsAt: '2027-03-10 13:00:00',
          newStartsAt: '2027-03-10 14:00:00',
          previousChairId: fx.chair1Id,
          newChairId: fx.chair1Id,
          reason: 'Motivo ficticio de reprogramación',
          occurredAt: '2027-03-01 12:00:00',
        },
      ]);
    });

    it('reprograma un CONFIRMADO a PROGRAMADO con cambio de sillón y un único evento de reprogramación', async () => {
      const appointment = await created();
      const confirmed = await changeStatus(appointment.id, 'CONFIRMADO');
      expect(confirmed.status).toBe(200);
      expect((await storedAppointmentRow(db(), appointment.id)).status).toBe('CONFIRMADO');

      const response = await reschedule(appointment.id, {
        fecha: '2027-03-10',
        horaInicio: '10:30',
        sillonId: fx.chair2Id,
        motivo: 'Motivo con   espacios',
      });
      expect(response.status).toBe(200);
      const body = response.body as LifecycleBody;
      expect(body.turno).toMatchObject({
        estado: 'PROGRAMADO',
        inicio: '2027-03-10T13:30:00.000Z',
        sillonId: fx.chair2Id,
      });
      expect(await storedAppointmentRow(db(), appointment.id)).toMatchObject({
        status: 'PROGRAMADO',
        startsAt: '2027-03-10 13:30:00',
        chairId: fx.chair2Id,
      });

      const events = await storedEventRows(db(), appointment.id);
      expect(events).toHaveLength(3);
      expect(events.filter((event) => event.type === 'CAMBIO_ESTADO')).toEqual([
        {
          type: 'CAMBIO_ESTADO',
          previousStatus: 'PROGRAMADO',
          newStatus: 'CONFIRMADO',
          previousStartsAt: null,
          newStartsAt: null,
          previousChairId: null,
          newChairId: null,
          reason: null,
          occurredAt: '2027-03-01 12:00:00',
        },
      ]);
      expect(events.filter((event) => event.type === 'REPROGRAMADO')).toEqual([
        {
          type: 'REPROGRAMADO',
          previousStatus: 'CONFIRMADO',
          newStatus: 'PROGRAMADO',
          previousStartsAt: '2027-03-10 13:00:00',
          newStartsAt: '2027-03-10 13:30:00',
          previousChairId: fx.chair1Id,
          newChairId: fx.chair2Id,
          reason: 'Motivo con espacios',
          occurredAt: '2027-03-01 12:00:00',
        },
      ]);
    });

    it('exige override justificado para una nueva ubicación fuera de horario y guarda la excepción', async () => {
      const appointment = await created();
      const rejected = await reschedule(appointment.id, {
        fecha: '2027-03-10',
        horaInicio: '18:00',
        motivo: 'Motivo ficticio',
      });
      expectError(rejected, 409, 'APPOINTMENT_OUTSIDE_AVAILABILITY');
      expect(errorOf(rejected).details).toEqual({
        requiereOverrideManual: true,
        inicio: '2027-03-10T21:00:00.000Z',
        finAtencion: '2027-03-10T21:30:00.000Z',
      });
      expect(await storedAppointmentRow(db(), appointment.id)).toMatchObject({
        startsAt: '2027-03-10 13:00:00',
        status: 'PROGRAMADO',
      });
      expect(await storedEventRows(db(), appointment.id)).toHaveLength(1);

      const accepted = await reschedule(appointment.id, {
        fecha: '2027-03-10',
        horaInicio: '18:00',
        motivo: '  Motivo   ficticio  ',
        fueraDisponibilidad: true,
        motivoExcepcion: '  Urgencia   ficticia  ',
      });
      expect(accepted.status).toBe(200);
      expect(await storedAppointmentRow(db(), appointment.id)).toMatchObject({
        startsAt: '2027-03-10 21:00:00',
        status: 'PROGRAMADO',
        outsideAvailability: 1,
        exceptionReason: 'Urgencia ficticia',
      });
      const events = await storedEventRows(db(), appointment.id);
      expect(events).toHaveLength(3);
      expect(events.map((event) => event.type).sort()).toEqual(['CREADO', 'EXCEPCION', 'REPROGRAMADO']);
      expect(events.find((event) => event.type === 'REPROGRAMADO')?.reason).toBe('Motivo ficticio');
      expect(events.find((event) => event.type === 'EXCEPCION')).toMatchObject({
        reason: 'Urgencia ficticia',
        previousStatus: null,
        newStatus: null,
        previousStartsAt: null,
        newStartsAt: null,
      });
    });

    it('un override innecesario al reprogramar se guarda como operación ordinaria', async () => {
      const appointment = await created();
      const response = await reschedule(appointment.id, {
        fecha: '2027-03-10',
        horaInicio: '11:00',
        motivo: 'Motivo ficticio',
        fueraDisponibilidad: true,
        motivoExcepcion: 'Urgencia ficticia',
      });
      expect(response.status).toBe(200);
      const body = response.body as LifecycleBody;
      expect(body.turno).toMatchObject({ fueraDisponibilidad: false, motivoExcepcion: null });
      expect(await storedAppointmentRow(db(), appointment.id)).toMatchObject({
        outsideAvailability: 0,
        exceptionReason: null,
        startsAt: '2027-03-10 14:00:00',
      });
      expect((await storedEventRows(db(), appointment.id)).map((event) => event.type).sort()).toEqual([
        'CREADO',
        'REPROGRAMADO',
      ]);
    });

    it('rechaza un sillón inactivo sin mutar el turno y lo acepta al reactivarlo', async () => {
      const appointment = await created();
      const before = await storedAppointmentRow(db(), appointment.id);
      const rejected = await reschedule(appointment.id, {
        fecha: '2027-03-10',
        horaInicio: '11:00',
        sillonId: fx.inactiveChairId,
        motivo: 'Motivo ficticio sillón inactivo',
      });
      expectError(rejected, 422, 'APPOINTMENT_REFERENCE_INVALID');
      expect(errorOf(rejected).details).toEqual({ campo: 'sillonId', motivo: 'INACTIVO' });
      expect(await storedAppointmentRow(db(), appointment.id)).toEqual(before);
      expect(await storedEventRows(db(), appointment.id)).toHaveLength(1);

      const reactivated = await http().patch(`/sillones/${fx.inactiveChairId}/estado`, { activo: true });
      expect(reactivated.status).toBe(200);
      const accepted = await reschedule(appointment.id, {
        fecha: '2027-03-10',
        horaInicio: '11:00',
        sillonId: fx.inactiveChairId,
        motivo: 'Motivo ficticio sillón reactivado',
      });
      expect(accepted.status).toBe(200);
      expect(await storedAppointmentRow(db(), appointment.id)).toMatchObject({
        chairId: fx.inactiveChairId,
        startsAt: '2027-03-10 14:00:00',
      });
    });

    it('rechaza reprogramar a un día bloqueado, incluso con override', async () => {
      const holiday = await http().post('/disponibilidad/excepciones', {
        fecha: '2027-03-17',
        tipo: 'FERIADO',
        motivo: 'Feriado ficticio C06',
      });
      expect(holiday.status).toBe(201);
      const appointment = await created();

      for (const extra of [{}, { fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' }]) {
        const response = await reschedule(appointment.id, {
          fecha: '2027-03-17',
          horaInicio: '10:00',
          motivo: 'Motivo ficticio feriado',
          ...extra,
        });
        expectError(response, 409, 'APPOINTMENT_BLOCKED_BY_EXCEPTION');
        expect(errorOf(response).details).toEqual({
          tipoExcepcion: 'FERIADO',
          motivoExcepcion: 'Feriado ficticio C06',
        });
      }
      expect(await storedAppointmentRow(db(), appointment.id)).toMatchObject({
        startsAt: '2027-03-10 13:00:00',
        status: 'PROGRAMADO',
      });
      expect(await storedEventRows(db(), appointment.id)).toHaveLength(1);
    });

    it('libera el horario al cancelar con motivo y conserva la fila CANCELADO', async () => {
      const appointment = await created();
      expectError(await book({ horaInicio: '10:15' }), 409, 'APPOINTMENT_CONFLICT');

      const response = await cancel(appointment.id, '  Cancelación   ficticia por prueba  ');
      expect(response.status).toBe(200);
      const body = response.body as LifecycleBody;
      expect(body.turno).toMatchObject({
        estado: 'CANCELADO',
        motivoCancelacion: 'Cancelación ficticia por prueba',
        inicio: '2027-03-10T13:00:00.000Z',
      });
      expect(await storedAppointmentRow(db(), appointment.id)).toMatchObject({
        status: 'CANCELADO',
        cancellationReason: 'Cancelación ficticia por prueba',
        startsAt: '2027-03-10 13:00:00',
      });
      const events = await storedEventRows(db(), appointment.id);
      expect(events).toHaveLength(2);
      expect(events.filter((event) => event.type === 'CANCELADO')).toEqual([
        {
          type: 'CANCELADO',
          previousStatus: 'PROGRAMADO',
          newStatus: 'CANCELADO',
          previousStartsAt: null,
          newStartsAt: null,
          previousChairId: null,
          newChairId: null,
          reason: 'Cancelación ficticia por prueba',
          occurredAt: '2027-03-01 12:00:00',
        },
      ]);

      const released = await created({ horaInicio: '10:15', sillonId: fx.chair2Id });
      expect((await storedAppointmentRow(db(), released.id)).startsAt).toBe('2027-03-10 13:15:00');

      const before = await storedAppointmentRow(db(), appointment.id);
      const beforeEvents = await storedEventRows(db(), appointment.id);
      const attempts = [
        { response: await reschedule(appointment.id, { fecha: '2027-03-10', horaInicio: '11:00', motivo: 'Motivo ficticio' }), operacion: 'REPROGRAMAR' },
        { response: await cancel(appointment.id, 'Otra cancelación ficticia'), operacion: 'CANCELAR' },
        { response: await changeStatus(appointment.id, 'CONFIRMADO'), operacion: 'CAMBIAR_ESTADO' },
      ];
      for (const attempt of attempts) {
        expectError(attempt.response, 409, 'APPOINTMENT_INVALID_TRANSITION');
        expect(errorOf(attempt.response).details).toEqual({ estadoActual: 'CANCELADO', operacion: attempt.operacion });
      }
      expect(await storedAppointmentRow(db(), appointment.id)).toEqual(before);
      expect(await storedEventRows(db(), appointment.id)).toEqual(beforeEvents);
      expectError(await changeStatus(appointment.id, 'CANCELADO'), 400, 'VALIDATION_ERROR');
    });

    it.each([
      { from: 'PROGRAMADO', to: 'CONFIRMADO', advanceClock: false },
      { from: 'PROGRAMADO', to: 'ATENDIDO', advanceClock: true },
      { from: 'PROGRAMADO', to: 'AUSENTE', advanceClock: true },
      { from: 'CONFIRMADO', to: 'ATENDIDO', advanceClock: true },
      { from: 'CONFIRMADO', to: 'AUSENTE', advanceClock: true },
    ])('permite la arista $from → $to con un CAMBIO_ESTADO sin motivo', async ({ from, to, advanceClock }) => {
      const appointment = await created();
      if (from === 'CONFIRMADO') expect((await changeStatus(appointment.id, 'CONFIRMADO')).status).toBe(200);
      if (advanceClock) context!.clock.set(new Date('2027-03-10T13:00:00.000Z'));

      const response = await changeStatus(appointment.id, to);
      expect(response.status).toBe(200);
      expect((response.body as LifecycleBody).turno.estado).toBe(to);
      expect((await storedAppointmentRow(db(), appointment.id)).status).toBe(to);
      const events = await storedEventRows(db(), appointment.id);
      expect(events.filter((event) => event.type === 'CAMBIO_ESTADO' && event.newStatus === to)).toEqual([
        {
          type: 'CAMBIO_ESTADO',
          previousStatus: from,
          newStatus: to,
          previousStartsAt: null,
          newStartsAt: null,
          previousChairId: null,
          newChairId: null,
          reason: null,
          occurredAt: advanceClock ? '2027-03-10 13:00:00' : '2027-03-01 12:00:00',
        },
      ]);
    });

    it('rechaza confirmar dos veces y registrar atención antes del inicio sin mutar la base', async () => {
      const appointment = await created();
      expect((await changeStatus(appointment.id, 'CONFIRMADO')).status).toBe(200);
      const repeated = await changeStatus(appointment.id, 'CONFIRMADO');
      expectError(repeated, 409, 'APPOINTMENT_INVALID_TRANSITION');
      expect(errorOf(repeated).details).toEqual({ estadoActual: 'CONFIRMADO', operacion: 'CAMBIAR_ESTADO' });

      const early = await created({ horaInicio: '12:00' });
      const before = await storedAppointmentRow(db(), early.id);
      const beforeEvents = await storedEventRows(db(), early.id);
      const tooEarly = await changeStatus(early.id, 'ATENDIDO');
      expectError(tooEarly, 422, 'APPOINTMENT_TOO_EARLY');
      expect(errorOf(tooEarly).details).toEqual({
        inicio: '2027-03-10T15:00:00.000Z',
        ahora: '2027-03-01T12:00:00.000Z',
      });
      expect(await storedAppointmentRow(db(), early.id)).toEqual(before);
      expect(await storedEventRows(db(), early.id)).toEqual(beforeEvents);
    });

    it.each(['ATENDIDO', 'AUSENTE', 'CANCELADO'])('bloquea toda operación sobre un turno %s', async (terminalStatus) => {
      const appointment = await created();
      if (terminalStatus === 'CANCELADO') {
        expect((await cancel(appointment.id, 'Cancelación ficticia terminal')).status).toBe(200);
      } else {
        context!.clock.set(new Date('2027-03-10T13:00:00.000Z'));
        expect((await changeStatus(appointment.id, terminalStatus)).status).toBe(200);
      }
      const before = await storedAppointmentRow(db(), appointment.id);
      const beforeEvents = await storedEventRows(db(), appointment.id);

      const attempts = [
        { response: await reschedule(appointment.id, { fecha: '2027-03-10', horaInicio: '11:00', motivo: 'Motivo ficticio' }), operacion: 'REPROGRAMAR' },
        { response: await cancel(appointment.id, 'Cancelación ficticia terminal 2'), operacion: 'CANCELAR' },
        { response: await changeStatus(appointment.id, 'CONFIRMADO'), operacion: 'CAMBIAR_ESTADO' },
      ];
      for (const attempt of attempts) {
        expectError(attempt.response, 409, 'APPOINTMENT_INVALID_TRANSITION');
        expect(errorOf(attempt.response).details).toEqual({ estadoActual: terminalStatus, operacion: attempt.operacion });
      }
      expect(await storedAppointmentRow(db(), appointment.id)).toEqual(before);
      expect(await storedEventRows(db(), appointment.id)).toEqual(beforeEvents);
    });
  });

  describe('atomicidad y concurrencia (4.3)', () => {
    it('si falla la escritura del historial no queda turno modificado ni evento huérfano', async () => {
      const appointment = await created();
      const before = await storedAppointmentRow(db(), appointment.id);
      const beforeEvents = await storedEventRows(db(), appointment.id);

      context!.writer.failNextEvents = true;
      const response = await reschedule(appointment.id, {
        fecha: '2027-03-10',
        horaInicio: '11:00',
        motivo: 'Motivo ficticio con fallo de historial',
      });
      expectError(response, 500, 'INTERNAL_ERROR');
      expect(await storedAppointmentRow(db(), appointment.id)).toEqual(before);
      expect(await storedEventRows(db(), appointment.id)).toEqual(beforeEvents);
      expect(await countAppointmentEvents(db())).toBe(1);
      expect(await countAppointments(db())).toBe(1);

      const recovered = await reschedule(appointment.id, {
        fecha: '2027-03-10',
        horaInicio: '11:00',
        motivo: 'Motivo ficticio tras recuperación',
      });
      expect(recovered.status).toBe(200);
      expect(await storedAppointmentRow(db(), appointment.id)).toMatchObject({
        startsAt: '2027-03-10 14:00:00',
        status: 'PROGRAMADO',
      });
      expect(await countAppointmentEvents(db())).toBe(2);
      expect((await storedEventRows(db(), appointment.id)).filter((event) => event.type === 'REPROGRAMADO')).toHaveLength(1);
    });

    it('dos reprogramaciones incompatibles al mismo sillón: exactamente una 200 y otra 409', async () => {
      const first = await created();
      const second = await created({ horaInicio: '12:00', sillonId: fx.chair2Id });
      const beforeFirst = await storedAppointmentRow(db(), first.id);
      const beforeSecond = await storedAppointmentRow(db(), second.id);

      const [firstResponse, secondResponse] = await Promise.all([
        reschedule(first.id, { fecha: '2027-03-10', horaInicio: '11:00', sillonId: fx.chair2Id, motivo: 'Motivo ficticio A' }),
        reschedule(second.id, { fecha: '2027-03-10', horaInicio: '11:00', sillonId: fx.chair2Id, motivo: 'Motivo ficticio B' }),
      ]);
      expect([firstResponse.status, secondResponse.status].sort((left, right) => left - right)).toEqual([200, 409]);
      const firstWon = firstResponse.status === 200;
      const winnerResponse = firstWon ? firstResponse : secondResponse;
      const loserResponse = firstWon ? secondResponse : firstResponse;
      const winner = firstWon ? first : second;
      const loser = firstWon ? second : first;
      const loserBefore = firstWon ? beforeSecond : beforeFirst;

      expect((winnerResponse.body as LifecycleBody).turno.inicio).toBe('2027-03-10T14:00:00.000Z');
      expectError(loserResponse, 409, 'APPOINTMENT_CONFLICT');
      expect(errorOf(loserResponse).details).toEqual({
        alcance: 'SILLON',
        conflictos: [
          {
            turnoId: winner.id,
            sillonId: fx.chair2Id,
            inicio: '2027-03-10T14:00:00.000Z',
            finBloqueo: '2027-03-10T14:40:00.000Z',
          },
        ],
      });
      expect(JSON.stringify(errorOf(loserResponse))).not.toMatch(/Paciente Ficticio|5555/u);

      expect(await storedAppointmentRow(db(), winner.id)).toMatchObject({
        startsAt: '2027-03-10 14:00:00',
        chairId: fx.chair2Id,
        status: 'PROGRAMADO',
      });
      expect(await storedAppointmentRow(db(), loser.id)).toEqual(loserBefore);
      expect((await storedEventRows(db(), winner.id)).filter((event) => event.type === 'REPROGRAMADO')).toHaveLength(1);
      expect((await storedEventRows(db(), loser.id)).filter((event) => event.type === 'REPROGRAMADO')).toHaveLength(0);
      expect(await countAppointments(db())).toBe(2);
      expect(await countAppointmentEvents(db())).toBe(3);
    });

    it('dos reprogramaciones incompatibles en sillones distintos informan alcance ODONTOLOGO', async () => {
      const first = await created();
      const second = await created({ horaInicio: '12:00', sillonId: fx.chair2Id });
      const beforeFirst = await storedAppointmentRow(db(), first.id);
      const beforeSecond = await storedAppointmentRow(db(), second.id);

      const [firstResponse, secondResponse] = await Promise.all([
        reschedule(first.id, { fecha: '2027-03-10', horaInicio: '11:00', sillonId: fx.chair1Id, motivo: 'Motivo ficticio A' }),
        reschedule(second.id, { fecha: '2027-03-10', horaInicio: '11:00', sillonId: fx.chair2Id, motivo: 'Motivo ficticio B' }),
      ]);
      expect([firstResponse.status, secondResponse.status].sort((left, right) => left - right)).toEqual([200, 409]);
      const firstWon = firstResponse.status === 200;
      const loserResponse = firstWon ? secondResponse : firstResponse;
      const winner = firstWon ? first : second;
      const loser = firstWon ? second : first;
      const loserBefore = firstWon ? beforeSecond : beforeFirst;

      expectError(loserResponse, 409, 'APPOINTMENT_CONFLICT');
      const details = errorOf(loserResponse).details;
      expect(details?.alcance).toBe('ODONTOLOGO');
      expect(details?.conflictos).toEqual([
        {
          turnoId: winner.id,
          sillonId: firstWon ? fx.chair1Id : fx.chair2Id,
          inicio: '2027-03-10T14:00:00.000Z',
          finBloqueo: '2027-03-10T14:40:00.000Z',
        },
      ]);
      expect(await storedAppointmentRow(db(), loser.id)).toEqual(loserBefore);
      expect((await storedEventRows(db(), winner.id)).filter((event) => event.type === 'REPROGRAMADO')).toHaveLength(1);
      expect((await storedEventRows(db(), loser.id)).filter((event) => event.type === 'REPROGRAMADO')).toHaveLength(0);
    });
  });

  describe('instantes e historial (4.4)', () => {
    interface HistoryResponse {
      turnoId: string;
      eventos: LifecycleBody['historial'];
    }

    it('la respuesta de mutación y el GET devuelven el mismo orden cronológico que MariaDB', async () => {
      const appointment = await created();
      const shifts: Array<[Date, () => Promise<{ status: number; body: unknown }>, string]> = [
        [new Date('2027-03-01T12:01:00.000Z'), () => reschedule(appointment.id, {
          fecha: '2027-03-10',
          horaInicio: '11:00',
          motivo: 'Motivo ficticio historial',
        }), 'REPROGRAMADO'],
        [new Date('2027-03-01T12:02:00.000Z'), () => changeStatus(appointment.id, 'CONFIRMADO'), 'CAMBIO_ESTADO'],
        [new Date('2027-03-01T12:03:00.000Z'), () => cancel(appointment.id, 'Cancelación ficticia historial'), 'CANCELADO'],
      ];
      let lastHistory: LifecycleBody['historial'] = [];
      for (const [instant, mutate, expectedType] of shifts) {
        context!.clock.set(instant);
        const response = await mutate();
        expect(response.status).toBe(200);
        lastHistory = (response.body as LifecycleBody).historial;
        expect(lastHistory.at(-1)?.tipo).toBe(expectedType);
      }

      const historyResponse = await http().get(`/turnos/${appointment.id}/historial`);
      expect(historyResponse.status).toBe(200);
      const history = historyResponse.body as HistoryResponse;
      expect(history.turnoId).toBe(appointment.id);
      expect(history.eventos).toEqual(lastHistory);
      expect(history.eventos.map((event) => [event.tipo, event.ocurridoEn])).toEqual([
        ['CREADO', '2027-03-01T12:00:00.000Z'],
        ['REPROGRAMADO', '2027-03-01T12:01:00.000Z'],
        ['CAMBIO_ESTADO', '2027-03-01T12:02:00.000Z'],
        ['CANCELADO', '2027-03-01T12:03:00.000Z'],
      ]);
      expect(history.eventos.map((event) => event.id)).toEqual(await storedEventIdsInOrder(db(), appointment.id));
      expect(history.eventos.find((event) => event.tipo === 'CREADO')).toMatchObject({
        estadoAnterior: null,
        inicioAnterior: null,
        sillonAnteriorId: null,
        motivo: null,
      });
      expect(history.eventos.find((event) => event.tipo === 'CAMBIO_ESTADO')?.motivo).toBeNull();
      expect(history.eventos.find((event) => event.tipo === 'CANCELADO')?.motivo).toBe('Cancelación ficticia historial');
      expect(JSON.stringify(history.eventos)).not.toMatch(/Paciente Ficticio|5555/u);
      expect(await storedEventRows(db(), appointment.id)).toHaveLength(4);
    });

    it('guarda instantes UTC literales en DATETIME(6) con cualquier zona del proceso', async () => {
      console.log(`[C-06] zona del proceso: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
      const columns = (await db().query(
        `SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType, DATETIME_PRECISION AS precisionValue
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME IN ('appointments', 'appointment_events')
            AND COLUMN_NAME IN ('starts_at', 'occurred_at')
          ORDER BY TABLE_NAME, COLUMN_NAME`,
      )) as Array<{ name: string; dataType: string; precisionValue: number }>;
      expect(
        columns
          .map((column) => ({ name: column.name, dataType: column.dataType, precision: Number(column.precisionValue) }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      ).toEqual([
        { name: 'occurred_at', dataType: 'datetime', precision: 6 },
        { name: 'starts_at', dataType: 'datetime', precision: 6 },
      ]);

      const appointment = await created();
      expect(appointment.inicio).toBe('2027-03-10T13:00:00.000Z');
      expect(await storedStartsAt(db(), appointment.id)).toBe('2027-03-10 13:00:00');

      context!.clock.set(new Date('2027-03-01T12:05:00.000Z'));
      const response = await reschedule(appointment.id, {
        fecha: '2027-03-10',
        horaInicio: '12:00',
        motivo: 'Motivo ficticio UTC',
      });
      expect(response.status).toBe(200);
      expect((response.body as LifecycleBody).turno.inicio).toBe('2027-03-10T15:00:00.000Z');
      expect(await storedStartsAt(db(), appointment.id)).toBe('2027-03-10 15:00:00');
      expect((await storedEventRows(db(), appointment.id)).map((event) => event.occurredAt)).toEqual([
        '2027-03-01 12:00:00',
        '2027-03-01 12:05:00',
      ]);
    });
  });
});
