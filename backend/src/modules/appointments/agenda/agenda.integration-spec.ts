import type { Response } from 'supertest';
import {
  FICTIONAL_CONTACT,
  TEST_NOW,
  api,
  clearAppointments,
  seedFixtures,
  setStatus,
  startAgendaApi,
  stopAgendaApi,
  type AgendaApiContext,
  type Fixtures,
} from './testing/agenda-api.support-spec.js';

/** Miércoles con tramos 09:00–13:00 y 16:00–20:00 (UTC−03:00): 10:00 local = 13:00Z. */
const WEDNESDAY = '2027-03-10';
const THURSDAY = '2027-03-11';

interface Reference {
  id: string;
  nombre: string;
}

interface AgendaTurnoBody {
  id: string;
  estado: string;
  inicio: string;
  finAtencion: string;
  finBloqueo: string;
  duracionMinutos: number;
  intervaloPosteriorMinutos: number;
  bloqueaHorario: boolean;
  fueraDisponibilidad: boolean;
  motivoExcepcion: string | null;
  paciente: Reference;
  prestacion: Reference;
  sillon: Reference;
}

interface AgendaDiaBody {
  fecha: string;
  tramos: Array<{ horaInicio: string; horaFin: string }>;
  bloqueos: Array<{ id: string; tipo: string; motivo: string; horaInicio: string | null; horaFin: string | null }>;
}

interface AgendaBody {
  zonaHoraria: string;
  desde: string;
  hasta: string;
  generadoEn: string;
  turnos: AgendaTurnoBody[];
  dias: AgendaDiaBody[];
}

interface ErrorBody {
  error: { code: string; message: string; requestId: string; details?: Record<string, unknown> };
}

describe('Lectura de agenda (integración MariaDB)', () => {
  let context: AgendaApiContext | undefined;
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

  const created = async (overrides: Record<string, unknown> = {}): Promise<{ id: string }> => {
    const response = await book(overrides);
    expect(response.status).toBe(201);
    return response.body as { id: string };
  };

  const agenda = async (queryString: string): Promise<AgendaBody> => {
    const response = await http().get(`/agenda?${queryString}`);
    expect(response.status).toBe(200);
    return response.body as AgendaBody;
  };

  const errorOf = (response: Response) => (response.body as ErrorBody).error;

  const expectError = (response: Response, status: number, code: string) => {
    expect(response.status).toBe(status);
    expect(typeof errorOf(response).requestId).toBe('string');
    expect(errorOf(response).code).toBe(code);
  };

  beforeAll(async () => {
    context = await startAgendaApi();
    fx = await seedFixtures(context);
  });

  beforeEach(async () => {
    await clearAppointments(db());
  });

  afterAll(async () => {
    await stopAgendaApi(context);
  });

  it('exige sesión vigente', async () => {
    await created();
    const response = await http().anonymousGet(`/agenda?desde=${WEDNESDAY}`);
    expect(response.status).toBe(401);
  });

  describe('consulta, orden y vacío', () => {
    it('devuelve el turno del día con instantes UTC y el reloj del servidor', async () => {
      const turno = await created();
      const body = await agenda(`desde=${WEDNESDAY}`);
      expect(body).toMatchObject({
        zonaHoraria: 'America/Argentina/Buenos_Aires',
        desde: WEDNESDAY,
        hasta: WEDNESDAY,
        generadoEn: TEST_NOW.toISOString(),
      });
      expect(body.turnos).toHaveLength(1);
      expect(body.turnos[0]).toMatchObject({
        id: turno.id,
        estado: 'PROGRAMADO',
        inicio: '2027-03-10T13:00:00.000Z',
        finAtencion: '2027-03-10T13:30:00.000Z',
        finBloqueo: '2027-03-10T13:40:00.000Z',
        duracionMinutos: 30,
        intervaloPosteriorMinutos: 10,
        bloqueaHorario: true,
        fueraDisponibilidad: false,
        motivoExcepcion: null,
      });
      expect(body.dias).toHaveLength(1);
    });

    it('ordena por inicio aunque los turnos se hayan creado al revés', async () => {
      await created({ horaInicio: '16:00' });
      await created({ horaInicio: '09:00' });
      await created({ horaInicio: '11:00' });
      const body = await agenda(`desde=${WEDNESDAY}`);
      expect(body.turnos.map((turno) => turno.inicio)).toEqual([
        '2027-03-10T12:00:00.000Z',
        '2027-03-10T14:00:00.000Z',
        '2027-03-10T19:00:00.000Z',
      ]);
    });

    it('mantiene un orden estable entre turnos cancelados con el mismo inicio', async () => {
      const first = await created({ horaInicio: '09:00' });
      await setStatus(db(), first.id, 'CANCELADO');
      const second = await created({ horaInicio: '09:00', sillonId: fx.chair2Id });
      await setStatus(db(), second.id, 'CANCELADO');

      const firstRead = await agenda(`desde=${WEDNESDAY}`);
      const secondRead = await agenda(`desde=${WEDNESDAY}`);
      expect(firstRead.turnos.map((turno) => turno.id)).toEqual([first.id, second.id]);
      expect(secondRead.turnos.map((turno) => turno.id)).toEqual([first.id, second.id]);
    });

    it('responde 200 con turnos vacíos y dias completo cuando no hay turnos', async () => {
      const body = await agenda('desde=2027-03-15');
      expect(body.turnos).toEqual([]);
      expect(body.dias).toEqual([{ fecha: '2027-03-15', tramos: [], bloqueos: [] }]);
    });

    it('cubre varios días y deja solo los turnos del rango', async () => {
      await created({ horaInicio: '09:00' });
      await created({ fecha: THURSDAY, horaInicio: '09:00' });
      const body = await agenda(`desde=${WEDNESDAY}&hasta=${THURSDAY}`);
      expect(body.turnos).toHaveLength(2);
      expect(body.dias.map((dia) => dia.fecha)).toEqual([WEDNESDAY, THURSDAY]);
    });
  });

  describe('ventana por día local', () => {
    it('incluye el turno de las 23:30 locales en su día y no el de las 00:30 del siguiente', async () => {
      const late = await created({ horaInicio: '23:30', fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' });
      const early = await created({ fecha: THURSDAY, horaInicio: '00:30', fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' });

      const wednesday = await agenda(`desde=${WEDNESDAY}&hasta=${WEDNESDAY}`);
      expect(wednesday.turnos.map((turno) => turno.id)).toEqual([late.id]);
      expect(wednesday.turnos[0]?.inicio).toBe('2027-03-11T02:30:00.000Z');

      const thursday = await agenda(`desde=${THURSDAY}&hasta=${THURSDAY}`);
      expect(thursday.turnos.map((turno) => turno.id)).toEqual([early.id]);
      expect(thursday.turnos[0]?.inicio).toBe('2027-03-11T03:30:00.000Z');
    });
  });

  describe('filtros', () => {
    it('filtra por sillón', async () => {
      await created({ horaInicio: '09:00' });
      const other = await created({ horaInicio: '10:00', sillonId: fx.chair2Id });
      const body = await agenda(`desde=${WEDNESDAY}&sillonId=${fx.chair2Id}`);
      expect(body.turnos.map((turno) => turno.id)).toEqual([other.id]);
      expect(body.turnos[0]?.sillon).toEqual({ id: fx.chair2Id, nombre: 'Sillón ficticio C07 B' });
    });

    it('permite consultar un sillón inactivo que conserva un turno atendido', async () => {
      const turno = await created({ horaInicio: '12:00', sillonId: fx.chair3Id });
      await setStatus(db(), turno.id, 'ATENDIDO');
      const deactivated = await http().patch(`/sillones/${fx.chair3Id}/estado`, { activo: false });
      expect(deactivated.status).toBe(200);
      try {
        const body = await agenda(`desde=${WEDNESDAY}&sillonId=${fx.chair3Id}`);
        expect(body.turnos.map((item) => [item.id, item.estado])).toEqual([[turno.id, 'ATENDIDO']]);
      } finally {
        await http().patch(`/sillones/${fx.chair3Id}/estado`, { activo: true });
      }
    });

    it('rechaza un sillón inexistente con 422 y un UUID inválido con 400', async () => {
      expectError(await http().get(`/agenda?desde=${WEDNESDAY}&sillonId=00000000-0000-4000-8000-0000000000aa`), 422, 'AGENDA_CHAIR_NOT_FOUND');
      expectError(await http().get(`/agenda?desde=${WEDNESDAY}&sillonId=abc`), 400, 'VALIDATION_ERROR');
    });

    it('filtra por estado y devuelve todos los estados sin filtro, con el cancelado como no bloqueante', async () => {
      const programmed = await created({ horaInicio: '09:00' });
      const confirmed = await created({ horaInicio: '10:00' });
      const cancelled = await created({ horaInicio: '11:00' });
      await setStatus(db(), confirmed.id, 'CONFIRMADO');
      await setStatus(db(), cancelled.id, 'CANCELADO');

      const some = await agenda(`desde=${WEDNESDAY}&estado=PROGRAMADO,CONFIRMADO`);
      expect(some.turnos.map((turno) => turno.id)).toEqual([programmed.id, confirmed.id]);

      const all = await agenda(`desde=${WEDNESDAY}`);
      expect(all.turnos.map((turno) => [turno.estado, turno.bloqueaHorario])).toEqual([
        ['PROGRAMADO', true],
        ['CONFIRMADO', true],
        ['CANCELADO', false],
      ]);
    });

    it('responde 200 con turnos vacíos cuando los filtros no coinciden', async () => {
      await created();
      const body = await agenda(`desde=${WEDNESDAY}&estado=ATENDIDO`);
      expect(body.turnos).toEqual([]);
      expect(body.dias).toHaveLength(1);
    });

    it('rechaza estados inválidos', async () => {
      expectError(await http().get(`/agenda?desde=${WEDNESDAY}&estado=PENDIENTE`), 400, 'VALIDATION_ERROR');
      expectError(await http().get(`/agenda?desde=${WEDNESDAY}&estado=`), 400, 'VALIDATION_ERROR');
    });
  });

  describe('rango', () => {
    it('acepta 31 días y rechaza 32 con el detalle del máximo', async () => {
      const atLimit = await agenda('desde=2027-03-01&hasta=2027-03-31');
      expect(atLimit.dias).toHaveLength(31);

      const tooLarge = await http().get('/agenda?desde=2027-03-01&hasta=2027-04-01');
      expectError(tooLarge, 400, 'AGENDA_RANGE_TOO_LARGE');
      expect(errorOf(tooLarge).details).toEqual({ maximoDias: 31, solicitadoDias: 32 });
    });

    it('acepta 31 días entre dos años', async () => {
      const body = await agenda('desde=2026-12-20&hasta=2027-01-19');
      expect(body.dias).toHaveLength(31);
      expect(body.dias[11]?.fecha).toBe('2026-12-31');
      expect(body.dias[12]?.fecha).toBe('2027-01-01');
    });

    it('rechaza rangos inválidos y parámetros mal formados', async () => {
      expectError(await http().get('/agenda?desde=2027-03-12&hasta=2027-03-10'), 400, 'AGENDA_RANGE_INVALID');
      expectError(await http().get('/agenda?desde=2027-02-30'), 400, 'AGENDA_RANGE_INVALID');
      expectError(await http().get('/agenda?desde=10/03/2027'), 400, 'VALIDATION_ERROR');
      expectError(await http().get('/agenda'), 400, 'VALIDATION_ERROR');
      expectError(await http().get(`/agenda?desde=${WEDNESDAY}&pagina=2`), 400, 'VALIDATION_ERROR');
    });
  });

  describe('atención, intervalo y excepción', () => {
    it('informa el intervalo de la prestación y deja la excepción en falso en un turno ordinario', async () => {
      await created({ horaInicio: '09:00', prestacionId: fx.procedureWithIntervalId });
      const [turno] = (await agenda(`desde=${WEDNESDAY}`)).turnos;
      expect(turno).toMatchObject({
        duracionMinutos: 30,
        intervaloPosteriorMinutos: 5,
        finAtencion: '2027-03-10T12:30:00.000Z',
        finBloqueo: '2027-03-10T12:35:00.000Z',
        fueraDisponibilidad: false,
        motivoExcepcion: null,
      });
    });

    it('marca la excepción con su motivo cuando el turno se creó fuera de disponibilidad', async () => {
      await created({ horaInicio: '14:00', fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' });
      const [turno] = (await agenda(`desde=${WEDNESDAY}`)).turnos;
      expect(turno).toMatchObject({ fueraDisponibilidad: true, motivoExcepcion: 'Urgencia ficticia' });
    });

    it('marca como bloqueantes los cuatro estados que ocupan horario y no el cancelado', async () => {
      const ids: string[] = [];
      for (const hour of ['09:00', '10:00', '11:00', '12:00', '16:00']) {
        ids.push((await created({ horaInicio: hour })).id);
      }
      const states = ['PROGRAMADO', 'CONFIRMADO', 'ATENDIDO', 'AUSENTE', 'CANCELADO'];
      for (const [index, id] of ids.entries()) {
        await setStatus(db(), id, states[index] ?? 'PROGRAMADO');
      }
      const body = await agenda(`desde=${WEDNESDAY}`);
      expect(body.turnos.map((turno) => [turno.estado, turno.bloqueaHorario])).toEqual([
        ['PROGRAMADO', true],
        ['CONFIRMADO', true],
        ['ATENDIDO', true],
        ['AUSENTE', true],
        ['CANCELADO', false],
      ]);
    });
  });

  describe('tramos y bloqueos por día', () => {
    it('refleja tramos semanales, feriado de día completo, bloqueo parcial y omite el cancelado', async () => {
      const holiday = await http().post('/disponibilidad/excepciones', { fecha: '2027-03-18', tipo: 'FERIADO', motivo: 'Feriado ficticio' });
      expect(holiday.status).toBe(201);
      const partial = await http().post('/disponibilidad/excepciones', {
        fecha: '2027-03-24',
        tipo: 'BLOQUEO',
        motivo: 'Bloqueo ficticio',
        horaInicio: '11:30',
        horaFin: '12:30',
      });
      expect(partial.status).toBe(201);
      const toCancel = await http().post('/disponibilidad/excepciones', { fecha: '2027-03-25', tipo: 'VACACIONES', motivo: 'Vacaciones ficticias' });
      expect(toCancel.status).toBe(201);
      const cancelled = await http().patch(`/disponibilidad/excepciones/${(toCancel.body as { id: string }).id}`, { activo: false });
      expect(cancelled.status).toBe(200);

      const body = await agenda('desde=2027-03-18&hasta=2027-03-25');
      expect(body.dias).toHaveLength(8);
      const byDate = new Map(body.dias.map((dia) => [dia.fecha, dia]));

      expect(byDate.get('2027-03-18')?.tramos).toEqual([{ horaInicio: '09:00', horaFin: '13:00' }]);
      expect(byDate.get('2027-03-18')?.bloqueos).toMatchObject([{ tipo: 'FERIADO', motivo: 'Feriado ficticio', horaInicio: null, horaFin: null }]);

      expect(byDate.get('2027-03-19')).toEqual({ fecha: '2027-03-19', tramos: [], bloqueos: [] });

      expect(byDate.get('2027-03-24')?.tramos).toEqual([
        { horaInicio: '09:00', horaFin: '13:00' },
        { horaInicio: '16:00', horaFin: '20:00' },
      ]);
      expect(byDate.get('2027-03-24')?.bloqueos).toMatchObject([{ tipo: 'BLOQUEO', horaInicio: '11:30', horaFin: '12:30' }]);

      expect(byDate.get('2027-03-25')?.bloqueos).toEqual([]);
    });

    it('los tramos y bloqueos no dependen de los filtros', async () => {
      const unfiltered = await agenda(`desde=${WEDNESDAY}`);
      const filtered = await agenda(`desde=${WEDNESDAY}&sillonId=${fx.chair2Id}&estado=ATENDIDO`);
      expect(filtered.dias).toEqual(unfiltered.dias);
    });
  });

  describe('privacidad', () => {
    it('identifica al paciente solo con id y nombre y no filtra contacto ni motivo de cancelación', async () => {
      const turno = await created({ horaInicio: '09:00' });
      const cancelled = await created({ horaInicio: '10:00' });
      await setStatus(db(), cancelled.id, 'CANCELADO', 'Motivo ficticio reservado');

      const response = await http().get(`/agenda?desde=${WEDNESDAY}`);
      expect(response.status).toBe(200);
      const body = response.body as AgendaBody;

      expect(body.turnos.find((item) => item.id === turno.id)?.paciente).toEqual({ id: fx.patientId, nombre: 'Paciente Ficticio C07 Uno' });
      for (const item of body.turnos) {
        expect(Object.keys(item.paciente).sort()).toEqual(['id', 'nombre']);
        expect(Object.keys(item.prestacion).sort()).toEqual(['id', 'nombre']);
        expect(Object.keys(item.sillon).sort()).toEqual(['id', 'nombre']);
        expect(Object.keys(item)).not.toContain('motivoCancelacion');
      }

      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain(FICTIONAL_CONTACT.phone);
      expect(raw).not.toContain(FICTIONAL_CONTACT.dni);
      expect(raw).not.toContain(FICTIONAL_CONTACT.email);
      expect(raw).not.toContain('Motivo ficticio reservado');
    });
  });
});
