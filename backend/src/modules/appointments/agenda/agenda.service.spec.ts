import { jest } from '@jest/globals';
import type { DataSource } from 'typeorm';
import type { AvailabilityService } from '../../availability/availability.service.js';
import type { ExcepcionResponse, TramoResponse } from '../../availability/dto/availability.dto.js';
import { FixedClock } from '../core/clock.js';
import type { AppointmentStatus } from '../core/domain/appointment-status.js';
import { AgendaError } from './agenda-errors.js';
import type { AgendaRow } from './agenda-response.js';
import { AgendaService } from './agenda.service.js';
import type { AgendaQueryDto } from './dto/agenda-query.dto.js';

const CHAIR_ID = '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91';
const NOW = new Date('2027-03-01T12:00:00.000Z');

const row = (overrides: Partial<AgendaRow> = {}): AgendaRow => ({
  id: 'turno-1',
  status: 'PROGRAMADO',
  startsAt: new Date('2027-03-10T13:00:00.000Z'),
  careEndsAt: new Date('2027-03-10T13:30:00.000Z'),
  blockEndsAt: new Date('2027-03-10T13:40:00.000Z'),
  durationMinutes: 30,
  postIntervalMinutes: 10,
  outsideAvailability: 0,
  exceptionReason: null,
  patientId: 'pa-1',
  patientName: 'Paciente Ficticio Uno',
  procedureId: 'pr-1',
  procedureName: 'Control ficticio',
  chairId: CHAIR_ID,
  chairName: 'Sillón A',
  ...overrides,
});

const tramo = (diaSemana: number, horaInicio: string, horaFin: string): TramoResponse => ({ diaSemana, horaInicio, horaFin });
const excepcion = (overrides: Partial<ExcepcionResponse>): ExcepcionResponse => ({
  id: 'ex-1',
  fecha: '2027-03-10',
  tipo: 'BLOQUEO',
  motivo: 'Motivo ficticio',
  horaInicio: null,
  horaFin: null,
  activo: true,
  inicioUtc: null,
  finUtc: null,
  ...overrides,
});

interface Setup {
  service: AgendaService;
  queries: Array<{ sql: string; params: unknown[] }>;
}

function setup(options: { rows?: AgendaRow[]; chairExists?: boolean; tramos?: TramoResponse[]; excepciones?: ExcepcionResponse[] } = {}): Setup {
  const queries: Setup['queries'] = [];
  const dataSource = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes('FROM chairs')) return options.chairExists === false ? [] : [{ id: CHAIR_ID }];
      return options.rows ?? [];
    }),
  };
  const availability = {
    getSemanales: jest.fn(async () => ({ tramos: options.tramos ?? [], version: 'v' })),
    listExcepciones: jest.fn(async () => options.excepciones ?? []),
  };
  const service = new AgendaService(
    dataSource as unknown as DataSource,
    availability as unknown as AvailabilityService,
    new FixedClock(NOW),
  );
  return { service, queries };
}

const query = (overrides: Partial<AgendaQueryDto> = {}): AgendaQueryDto => ({ desde: '2027-03-10', ...overrides });
const appointmentsQuery = (queries: Setup['queries']) => queries.find((item) => item.sql.includes('FROM appointments'));

async function failure(promise: Promise<unknown>): Promise<AgendaError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AgendaError) return error;
    throw error;
  }
  throw new Error('Se esperaba un AgendaError');
}

describe('AgendaService — ventana, filtros y orden', () => {
  it('convierte el día local a una ventana UTC semiabierta y la envía ordenada de forma estable', async () => {
    const { service, queries } = setup();
    await service.consultar(query());
    const sent = appointmentsQuery(queries);
    expect(sent?.params).toEqual([new Date('2027-03-10T03:00:00.000Z'), new Date('2027-03-11T03:00:00.000Z')]);
    expect(sent?.sql).toContain('ORDER BY a.starts_at ASC, a.created_at ASC, a.id ASC');
    expect(sent?.sql).toContain('a.starts_at >= ? AND a.starts_at < ?');
  });

  it('amplía la ventana hasta el día posterior a hasta', async () => {
    const { service, queries } = setup();
    await service.consultar(query({ desde: '2027-03-10', hasta: '2027-03-12' }));
    expect(appointmentsQuery(queries)?.params).toEqual([new Date('2027-03-10T03:00:00.000Z'), new Date('2027-03-13T03:00:00.000Z')]);
  });

  it('agrega los filtros de sillón y de estado sin duplicados', async () => {
    const { service, queries } = setup();
    const estado: AppointmentStatus[] = ['PROGRAMADO', 'CONFIRMADO', 'PROGRAMADO'];
    await service.consultar(query({ sillonId: CHAIR_ID, estado }));
    const sent = appointmentsQuery(queries);
    expect(sent?.sql).toContain('a.chair_id = ?');
    expect(sent?.sql).toContain('a.status IN (?, ?)');
    expect(sent?.params.slice(2)).toEqual([CHAIR_ID, 'PROGRAMADO', 'CONFIRMADO']);
  });

  it('sin filtros no agrega condiciones de sillón ni de estado', async () => {
    const { service, queries } = setup();
    await service.consultar(query());
    const sql = appointmentsQuery(queries)?.sql ?? '';
    expect(sql).not.toContain('a.chair_id = ?');
    expect(sql).not.toContain('a.status IN');
  });

  it('conserva el orden de las filas que entrega la base', async () => {
    const rows = [row({ id: 'b' }), row({ id: 'a' }), row({ id: 'c' })];
    const { service } = setup({ rows });
    const result = await service.consultar(query());
    expect(result.turnos.map((turno) => turno.id)).toEqual(['b', 'a', 'c']);
  });

  it('rechaza un sillón inexistente antes de consultar turnos', async () => {
    const { service, queries } = setup({ chairExists: false });
    const error = await failure(service.consultar(query({ sillonId: CHAIR_ID })));
    expect(error.code).toBe('AGENDA_CHAIR_NOT_FOUND');
    expect(error.getStatus()).toBe(422);
    expect(appointmentsQuery(queries)).toBeUndefined();
  });

  it.each([
    [{ desde: '2027-03-12', hasta: '2027-03-10' }, 'AGENDA_RANGE_INVALID'],
    [{ desde: '2027-02-30' }, 'AGENDA_RANGE_INVALID'],
    [{ desde: '2027-03-01', hasta: '2027-04-01' }, 'AGENDA_RANGE_TOO_LARGE'],
  ])('rechaza el rango %j con %s sin tocar la base', async (input, code) => {
    const { service, queries } = setup();
    const error = await failure(service.consultar(query(input)));
    expect(error.code).toBe(code);
    expect(error.getStatus()).toBe(400);
    expect(queries).toHaveLength(0);
  });

  it('informa el máximo y lo solicitado cuando el rango es excesivo', async () => {
    const { service } = setup();
    const error = await failure(service.consultar(query({ desde: '2027-03-01', hasta: '2027-04-01' })));
    expect(error.details).toEqual({ maximoDias: 31, solicitadoDias: 32 });
  });
});

describe('AgendaService — contenido de la respuesta', () => {
  it('toma generadoEn del reloj del servidor y devuelve zona y rango', async () => {
    const { service } = setup();
    const result = await service.consultar(query());
    expect(result).toMatchObject({ zonaHoraria: 'America/Argentina/Buenos_Aires', desde: '2027-03-10', hasta: '2027-03-10', generadoEn: NOW.toISOString() });
  });

  it('mapea atención, intervalo y bloqueo del horario por estado', async () => {
    const statuses: AppointmentStatus[] = ['PROGRAMADO', 'CONFIRMADO', 'ATENDIDO', 'AUSENTE', 'CANCELADO'];
    const { service } = setup({ rows: statuses.map((status) => row({ id: status, status })) });
    const result = await service.consultar(query());
    expect(result.turnos.map((turno) => [turno.estado, turno.bloqueaHorario])).toEqual([
      ['PROGRAMADO', true],
      ['CONFIRMADO', true],
      ['ATENDIDO', true],
      ['AUSENTE', true],
      ['CANCELADO', false],
    ]);
    expect(result.turnos[0]).toMatchObject({
      inicio: '2027-03-10T13:00:00.000Z',
      finAtencion: '2027-03-10T13:30:00.000Z',
      finBloqueo: '2027-03-10T13:40:00.000Z',
      duracionMinutos: 30,
      intervaloPosteriorMinutos: 10,
      fueraDisponibilidad: false,
      motivoExcepcion: null,
    });
  });

  it('informa la excepción con su motivo, aceptando el booleano como 1 o true', async () => {
    const { service } = setup({ rows: [row({ outsideAvailability: 1, exceptionReason: 'Urgencia ficticia' }), row({ id: 't2', outsideAvailability: true, exceptionReason: 'Otra ficticia' })] });
    const result = await service.consultar(query());
    expect(result.turnos.map((turno) => [turno.fueraDisponibilidad, turno.motivoExcepcion])).toEqual([
      [true, 'Urgencia ficticia'],
      [true, 'Otra ficticia'],
    ]);
  });

  it('identifica paciente, prestación y sillón solo con id y nombre', async () => {
    const { service } = setup({ rows: [row()] });
    const [turno] = (await service.consultar(query())).turnos;
    expect(turno?.paciente).toEqual({ id: 'pa-1', nombre: 'Paciente Ficticio Uno' });
    expect(Object.keys(turno?.prestacion ?? {})).toEqual(['id', 'nombre']);
    expect(Object.keys(turno?.sillon ?? {})).toEqual(['id', 'nombre']);
  });

  it('no deja pasar campos extra de la base ni lee columnas de contacto o clínicas', async () => {
    const leaky = { ...row(), phone: '11 5555-0001', dni: '12345678', email: 'x@example.test', cancellationReason: 'motivo' };
    const { service, queries } = setup({ rows: [leaky] });
    const result = await service.consultar(query());
    expect(JSON.stringify(result)).not.toMatch(/5555|12345678|x@example\.test|motivo"/u);
    const sql = appointmentsQuery(queries)?.sql ?? '';
    expect(sql).not.toMatch(/phone|dni|email|cancellation_reason|SELECT \*|a\.\*|p\.\*/iu);
  });
});

describe('AgendaService — días', () => {
  it('arma un elemento por día con tramos ordenados y bloqueos parcial y de día completo', async () => {
    const { service } = setup({
      tramos: [tramo(3, '16:00:00', '20:00:00'), tramo(3, '09:00:00', '13:00:00'), tramo(4, '09:00', '12:00')],
      excepciones: [
        excepcion({ id: 'ex-parcial', fecha: '2027-03-10', horaInicio: '11:00:00', horaFin: '12:30:00' }),
        excepcion({ id: 'ex-feriado', fecha: '2027-03-11', tipo: 'FERIADO', motivo: 'Feriado ficticio' }),
      ],
    });
    const result = await service.consultar(query({ desde: '2027-03-10', hasta: '2027-03-12' }));
    expect(result.dias.map((dia) => dia.fecha)).toEqual(['2027-03-10', '2027-03-11', '2027-03-12']);
    expect(result.dias[0]).toEqual({
      fecha: '2027-03-10',
      tramos: [
        { horaInicio: '09:00', horaFin: '13:00' },
        { horaInicio: '16:00', horaFin: '20:00' },
      ],
      bloqueos: [{ id: 'ex-parcial', tipo: 'BLOQUEO', motivo: 'Motivo ficticio', horaInicio: '11:00', horaFin: '12:30' }],
    });
    expect(result.dias[1]?.bloqueos).toEqual([{ id: 'ex-feriado', tipo: 'FERIADO', motivo: 'Feriado ficticio', horaInicio: null, horaFin: null }]);
    expect(result.dias[1]?.tramos).toEqual([{ horaInicio: '09:00', horaFin: '12:00' }]);
  });

  it('deja tramos vacíos en un día sin disponibilidad semanal', async () => {
    const { service } = setup({ tramos: [tramo(3, '09:00', '13:00')] });
    const result = await service.consultar(query({ desde: '2027-03-14' }));
    expect(result.dias).toEqual([{ fecha: '2027-03-14', tramos: [], bloqueos: [] }]);
  });

  it('omite las excepciones inactivas y las de otras fechas', async () => {
    const { service } = setup({ excepciones: [excepcion({ id: 'cancelada', activo: false }), excepcion({ id: 'otra-fecha', fecha: '2027-04-01' })] });
    const result = await service.consultar(query());
    expect(result.dias[0]?.bloqueos).toEqual([]);
  });

  it('ordena los bloqueos poniendo primero el de día completo', async () => {
    const { service } = setup({
      excepciones: [excepcion({ id: 'b', horaInicio: '10:00', horaFin: '11:00' }), excepcion({ id: 'a' })],
    });
    const result = await service.consultar(query());
    expect(result.dias[0]?.bloqueos.map((bloqueo) => bloqueo.id)).toEqual(['a', 'b']);
  });

  it('los tramos y bloqueos no dependen de los filtros', async () => {
    const { service } = setup({ tramos: [tramo(3, '09:00', '13:00')], excepciones: [excepcion({})] });
    const filtered = await service.consultar(query({ sillonId: CHAIR_ID, estado: ['ATENDIDO'] }));
    const unfiltered = await service.consultar(query());
    expect(filtered.dias).toEqual(unfiltered.dias);
  });

  it('devuelve 200 con turnos vacíos y dias completo cuando no hay turnos', async () => {
    const { service } = setup();
    const result = await service.consultar(query());
    expect(result.turnos).toEqual([]);
    expect(result.dias).toHaveLength(1);
  });
});
