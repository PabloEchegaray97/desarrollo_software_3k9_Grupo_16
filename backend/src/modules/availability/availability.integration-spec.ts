import 'reflect-metadata';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  AVAILABILITY_EVALUATION_PORT,
  type AvailabilityEvaluationPort,
} from './availability.port.js';
import type { ResultadoEvaluacion } from './domain/availability-policy.js';
import { validateTestDatabaseEnvironment } from '../../config/env.validation.js';
import { testDataSourceOptions } from '../../database/data-source.js';
import {
  expectApiError,
  resetAvailabilityData,
  startAvailabilityApi,
  stopAvailabilityApi,
  type AvailabilityApiContext,
} from './testing/api-harness.support-spec.js';
import { ConfiguracionAgendaEntity } from './entities/configuracion-agenda.entity.js';
import { DisponibilidadSemanalEntity } from './entities/disponibilidad-semanal.entity.js';
import { ExcepcionDisponibilidadEntity } from './entities/excepcion-disponibilidad.entity.js';

/** Fuente de datos de pruebas con entidades explícitas: MariaDB real, nunca memoria. */
function createC03DataSource(): DataSource {
  return new DataSource({
    ...testDataSourceOptions(validateTestDatabaseEnvironment(process.env)),
    // Los DATETIME se leen como instantes UTC, nunca con la zona del proceso.
    timezone: 'Z',
    entities: [
      ConfiguracionAgendaEntity,
      DisponibilidadSemanalEntity,
      ExcepcionDisponibilidadEntity,
    ],
  });
}

const CONFIGURACION_UNICA_ID = '00000000-0000-4000-8000-000000000001';

const TABLAS_C03 = [
  'configuracion_agenda',
  'disponibilidad_semanal',
  'excepcion_disponibilidad',
] as const;

describe('Persistencia C03 (integración MariaDB real)', () => {
  let dataSource: DataSource | undefined;

  beforeAll(async () => {
    dataSource = createC03DataSource();
    await dataSource.initialize();
    await dataSource.runMigrations({ transaction: 'all' });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.undoLastMigration({ transaction: 'all' });
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    const source = dataSource!;
    await source.query('DELETE FROM excepcion_disponibilidad');
    await source.query('DELETE FROM disponibilidad_semanal');
    await source.query(
      'DELETE FROM configuracion_agenda WHERE id <> ?',
      [CONFIGURACION_UNICA_ID],
    );
  });

  it('crea las tres tablas y deja una sola configuración inicial con intervalo 10 y zona IANA', async () => {
    const source = dataSource!;
    const found = (await source.query(
      `SELECT TABLE_NAME AS name FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?)`,
      [...TABLAS_C03],
    )) as Array<{ name: string }>;

    expect(found.map((row) => row.name).sort()).toEqual([...TABLAS_C03].sort());

    const configuraciones = await source.getRepository(ConfiguracionAgendaEntity).find();
    expect(configuraciones).toHaveLength(1);
    expect(configuraciones[0].id).toBe(CONFIGURACION_UNICA_ID);
    expect(configuraciones[0]).toMatchObject({
      intervaloGlobalMinutos: 10,
      zonaHoraria: 'America/Argentina/Buenos_Aires',
    });
  });

  it('persiste la zona como nombre IANA y jamás como offset fijo', async () => {
    const source = dataSource!;
    const filas = (await source.query(
      'SELECT zona_horaria AS zona FROM configuracion_agenda',
    )) as Array<{ zona: string }>;

    expect(filas).toHaveLength(1);
    expect(filas[0].zona).toBe('America/Argentina/Buenos_Aires');
    expect(filas[0].zona).not.toContain('-03:00');
  });

  it('rechaza una segunda configuración aunque tenga otro id', async () => {
    const source = dataSource!;
    await expect(
      source.query(
        `INSERT INTO configuracion_agenda (id, intervalo_global_minutos, zona_horaria)
         VALUES (?, 25, ?)`,
        ['00000000-0000-4000-8000-000000000002', 'America/Argentina/Buenos_Aires'],
      ),
    ).rejects.toThrow(/Duplicate|UNIQUE/i);

    const restantes = (await source.query(
      'SELECT id FROM configuracion_agenda',
    )) as Array<{ id: string }>;
    expect(restantes).toHaveLength(1);
  });

  it('conserva motivo, fecha local y estado al desactivar y reactivar una excepción', async () => {
    const source = dataSource!;
    const id = '00000000-0000-4000-8000-000000000011';
    await source.query(
      `INSERT INTO excepcion_disponibilidad (id, fecha, tipo, motivo)
       VALUES (?, '2026-12-25', 'VACACIONES', ?)`,
      [id, 'Feriado ficticio'],
    );

    await source.query(
      'UPDATE excepcion_disponibilidad SET activo = FALSE WHERE id = ?',
      [id],
    );
    const inactiva = (await source.query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, motivo, activo
       FROM excepcion_disponibilidad WHERE id = ?`,
      [id],
    )) as Array<{ fecha: string; motivo: string; activo: number }>;
    expect(inactiva).toHaveLength(1);
    expect(inactiva[0]).toMatchObject({
      fecha: '2026-12-25',
      motivo: 'Feriado ficticio',
      activo: 0,
    });

    await source.query(
      'UPDATE excepcion_disponibilidad SET activo = TRUE WHERE id = ?',
      [id],
    );
    const reactivada = (await source.query(
      'SELECT motivo, activo FROM excepcion_disponibilidad WHERE id = ?',
      [id],
    )) as Array<{ motivo: string; activo: number }>;
    expect(reactivada[0]).toMatchObject({ motivo: 'Feriado ficticio', activo: 1 });
  });

  it('guarda instantes UTC sin convertirlos a un offset fijo', async () => {
    const source = dataSource!;
    const id = '00000000-0000-4000-8000-000000000012';
    await source.query(
      `INSERT INTO excepcion_disponibilidad
         (id, fecha, tipo, motivo, hora_inicio, hora_fin, inicio_utc, fin_utc)
       VALUES (?, '2026-12-25', 'BLOQUEO', ?, '11:00:00', '12:30:00', ?, ?)`,
      [
        id,
        'Bloqueo ficticio',
        '2026-12-25 14:00:00.000000',
        '2026-12-25 15:30:00.000000',
      ],
    );

    const fila = (await source.query(
      'SELECT inicio_utc, fin_utc FROM excepcion_disponibilidad WHERE id = ?',
      [id],
    )) as Array<{ inicio_utc: string; fin_utc: string }>;
    expect(fila).toHaveLength(1);
    expect(new Date(fila[0].inicio_utc).toISOString()).toBe('2026-12-25T14:00:00.000Z');
    expect(new Date(fila[0].fin_utc).toISOString()).toBe('2026-12-25T15:30:00.000Z');

    const todo = await source.query('SELECT * FROM excepcion_disponibilidad');
    expect(JSON.stringify(todo)).not.toContain('-03:00');
  });
});

describe('API C03 (integración MariaDB real)', () => {
  let context: AvailabilityApiContext | undefined;

  const http = () => {
    const client = request(context!.app.getHttpServer());
    const authenticated = (testRequest: request.Test) =>
      testRequest.set('Cookie', context!.sessionCookie);
    return {
      get: (url: string) => authenticated(client.get(url)),
      patch: (url: string) => authenticated(client.patch(url)),
      post: (url: string) => authenticated(client.post(url)),
      put: (url: string) => authenticated(client.put(url)),
    };
  };

  beforeAll(async () => {
    context = await startAvailabilityApi();
  });

  afterAll(async () => {
    await stopAvailabilityApi(context);
  });

  beforeEach(async () => {
    await resetAvailabilityData(context!.dataSource);
  });

  describe('configuración global (4.1)', () => {
    it('devuelve el valor inicial y actualiza a 25 manteniendo una sola fila', async () => {
      const inicial = await http().get('/api/disponibilidad/configuracion').expect(200);
      expect(inicial.body).toEqual({
        intervaloGlobalMinutos: 10,
        zonaHoraria: 'America/Argentina/Buenos_Aires',
      });

      const actualizada = await http()
        .patch('/api/disponibilidad/configuracion')
        .send({ intervaloGlobalMinutos: 25 })
        .expect(200);
      expect(actualizada.body).toEqual({
        intervaloGlobalMinutos: 25,
        zonaHoraria: 'America/Argentina/Buenos_Aires',
      });

      const filas = (await context!.dataSource.query(
        'SELECT id, intervalo_global_minutos AS intervalo FROM configuracion_agenda',
      )) as Array<{ id: string; intervalo: number }>;
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        id: CONFIGURACION_UNICA_ID,
        intervalo: 25,
      });
    });

    it('rechaza -1, 31 y 10,5 con 400 sin cambiar la configuración', async () => {
      for (const valor of [-1, 31, 10.5]) {
        const response = await http()
          .patch('/api/disponibilidad/configuracion')
          .send({ intervaloGlobalMinutos: valor });
        expectApiError(response, 400);
      }

      const fila = (await context!.dataSource.query(
        'SELECT intervalo_global_minutos AS intervalo FROM configuracion_agenda',
      )) as Array<{ intervalo: number }>;
      expect(fila[0]?.intervalo).toBe(10);
    });

    it('rechaza intentar cambiar la zona horaria con 400', async () => {
      const response = await http()
        .patch('/api/disponibilidad/configuracion')
        .send({ zonaHoraria: 'UTC' });
      expectApiError(response, 400);

      const fila = (await context!.dataSource.query(
        'SELECT zona_horaria AS zona FROM configuracion_agenda',
      )) as Array<{ zona: string }>;
      expect(fila[0]?.zona).toBe('America/Argentina/Buenos_Aires');
    });
  });

  describe('tramos semanales (4.3/4.4)', () => {
    it('reemplaza el conjunto por dos tramos y lo devuelve exactamente', async () => {
      const puesta = await http()
        .put('/api/disponibilidad/semanales')
        .send({
          tramos: [
            { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
            { diaSemana: 1, horaInicio: '16:00', horaFin: '20:00' },
          ],
        })
        .expect(200);
      expect(puesta.body.tramos).toEqual([
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        { diaSemana: 1, horaInicio: '16:00', horaFin: '20:00' },
      ]);
      expect(typeof puesta.body.version).toBe('string');

      const consulta = await http().get('/api/disponibilidad/semanales').expect(200);
      expect(consulta.body.tramos).toEqual(puesta.body.tramos);
      expect(consulta.body.version).toBe(puesta.body.version);

      const filas = (await context!.dataSource.query(
        'SELECT dia_semana AS dia, hora_inicio AS inicio, hora_fin AS fin FROM disponibilidad_semanal ORDER BY dia, inicio',
      )) as Array<{ dia: number; inicio: string; fin: string }>;
      expect(filas).toHaveLength(2);
      expect(filas[0]).toMatchObject({ dia: 1, inicio: '09:00:00', fin: '13:00:00' });
    });

    it('rechaza rangos incompatibles sin dejar tramos parciales ni borrar el conjunto anterior', async () => {
      await http()
        .put('/api/disponibilidad/semanales')
        .send({ tramos: [{ diaSemana: 2, horaInicio: '10:00', horaFin: '12:00' }] })
        .expect(200);

      const rechazada = await http()
        .put('/api/disponibilidad/semanales')
        .send({
          tramos: [
            { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
            { diaSemana: 2, horaInicio: '11:30', horaFin: '13:00' },
            { diaSemana: 2, horaInicio: '10:00', horaFin: '12:00' },
          ],
        });
      expectApiError(rechazada, 400);

      const consulta = await http().get('/api/disponibilidad/semanales').expect(200);
      expect(consulta.body.tramos).toEqual([
        { diaSemana: 2, horaInicio: '10:00', horaFin: '12:00' },
      ]);
      const filas = (await context!.dataSource.query(
        'SELECT COUNT(*) AS total FROM disponibilidad_semanal',
      )) as Array<{ total: number }>;
      expect(Number(filas[0]?.total)).toBe(1);
    });

    it('acepta tramos contiguos y rechaza invertidos y día fuera de rango', async () => {
      const contiguos = await http()
        .put('/api/disponibilidad/semanales')
        .send({
          tramos: [
            { diaSemana: 3, horaInicio: '10:00', horaFin: '12:00' },
            { diaSemana: 3, horaInicio: '12:00', horaFin: '13:00' },
          ],
        })
        .expect(200);
      expect(contiguos.body.tramos).toHaveLength(2);

      for (const tramo of [
        { diaSemana: 3, horaInicio: '13:00', horaFin: '12:00' },
        { diaSemana: 0, horaInicio: '10:00', horaFin: '12:00' },
        { diaSemana: 8, horaInicio: '10:00', horaFin: '12:00' },
      ]) {
        const rechazada = await http()
          .put('/api/disponibilidad/semanales')
          .send({ tramos: [tramo] });
        expectApiError(rechazada, 400);
      }

      const consulta = await http().get('/api/disponibilidad/semanales').expect(200);
      expect(consulta.body.tramos).toEqual(contiguos.body.tramos);
    });
  });

  describe('excepciones (4.5/4.6)', () => {
    it('crea un feriado de día completo y un bloqueo parcial con instantes UTC', async () => {
      const feriado = await http()
        .post('/api/disponibilidad/excepciones')
        .send({ fecha: '2026-12-25', tipo: 'FERIADO', motivo: 'Feriado ficticio' })
        .expect(201);
      expect(feriado.body).toMatchObject({
        fecha: '2026-12-25',
        tipo: 'FERIADO',
        motivo: 'Feriado ficticio',
        horaInicio: null,
        horaFin: null,
        activo: true,
        inicioUtc: null,
        finUtc: null,
      });
      expect(typeof feriado.body.id).toBe('string');

      const bloqueo = await http()
        .post('/api/disponibilidad/excepciones')
        .send({
          fecha: '2026-07-15',
          tipo: 'BLOQUEO',
          motivo: 'Mantenimiento ficticio',
          horaInicio: '11:00',
          horaFin: '12:30',
        })
        .expect(201);
      expect(bloqueo.body.inicioUtc).toBe('2026-07-15T14:00:00.000Z');
      expect(bloqueo.body.finUtc).toBe('2026-07-15T15:30:00.000Z');

      const lista = await http().get('/api/disponibilidad/excepciones').expect(200);
      expect(lista.body.map((item: { tipo: string }) => item.tipo)).toEqual([
        'BLOQUEO',
        'FERIADO',
      ]);

      const filas = (await context!.dataSource.query(
        `SELECT DATE_FORMAT(inicio_utc, '%Y-%m-%dT%H:%i:%s.000Z') AS inicio,
                DATE_FORMAT(fin_utc, '%Y-%m-%dT%H:%i:%s.000Z') AS fin
         FROM excepcion_disponibilidad WHERE tipo = 'BLOQUEO'`,
      )) as Array<{ inicio: string; fin: string }>;
      expect(filas[0]).toMatchObject({
        inicio: '2026-07-15T14:00:00.000Z',
        fin: '2026-07-15T15:30:00.000Z',
      });
    });

    it('rechaza motivo vacío, rango invertido y tipo no permitido sin persistir', async () => {
      const entradas = [
        { fecha: '2026-12-25', tipo: 'FERIADO', motivo: '   ' },
        {
          fecha: '2026-12-25',
          tipo: 'BLOQUEO',
          motivo: 'Mantenimiento ficticio',
          horaInicio: '14:00',
          horaFin: '13:00',
        },
        { fecha: '2026-12-25', tipo: 'HABILITACION', motivo: 'Habilitación ficticia' },
      ];
      for (const entrada of entradas) {
        const response = await http().post('/api/disponibilidad/excepciones').send(entrada);
        expectApiError(response, 400);
      }

      const filas = (await context!.dataSource.query(
        'SELECT COUNT(*) AS total FROM excepcion_disponibilidad',
      )) as Array<{ total: number }>;
      expect(Number(filas[0]?.total)).toBe(0);
    });

    it('responde 404 para un id inexistente y conserva la fecha local sin offset fijo', async () => {
      const inexistente = await http().get(
        '/api/disponibilidad/excepciones/00000000-0000-4000-8000-000000000099',
      );
      expectApiError(inexistente, 404);

      const creada = await http()
        .post('/api/disponibilidad/excepciones')
        .send({ fecha: '2027-01-15', tipo: 'VACACIONES', motivo: 'Vacaciones ficticias' })
        .expect(201);
      expect(creada.body.fecha).toBe('2027-01-15');
      expect(JSON.stringify(creada.body)).not.toContain('-03:00');
    });
  });

  describe('baja lógica de excepciones (4.7/4.8)', () => {
    it('oculta la excepción cancelada de la lista activa pero la conserva por id', async () => {
      const creada = await http()
        .post('/api/disponibilidad/excepciones')
        .send({ fecha: '2026-12-25', tipo: 'FERIADO', motivo: 'Feriado ficticio' })
        .expect(201);
      const id = creada.body.id as string;

      const cancelada = await http()
        .patch(`/api/disponibilidad/excepciones/${id}`)
        .send({ activo: false })
        .expect(200);
      expect(cancelada.body).toMatchObject({
        id,
        activo: false,
        fecha: '2026-12-25',
        motivo: 'Feriado ficticio',
      });

      const activas = await http().get('/api/disponibilidad/excepciones').expect(200);
      expect(activas.body).toEqual([]);

      const porId = await http().get(`/api/disponibilidad/excepciones/${id}`).expect(200);
      expect(porId.body).toMatchObject({
        id,
        activo: false,
        fecha: '2026-12-25',
        motivo: 'Feriado ficticio',
      });
    });

    it('reactiva conservando motivo y fecha, sin borrado físico, y falla con id inexistente', async () => {
      const creada = await http()
        .post('/api/disponibilidad/excepciones')
        .send({
          fecha: '2026-07-15',
          tipo: 'BLOQUEO',
          motivo: 'Mantenimiento ficticio',
          horaInicio: '11:00',
          horaFin: '12:30',
        })
        .expect(201);
      const id = creada.body.id as string;
      await http().patch(`/api/disponibilidad/excepciones/${id}`).send({ activo: false }).expect(200);

      const reactivada = await http()
        .patch(`/api/disponibilidad/excepciones/${id}`)
        .send({ activo: true })
        .expect(200);
      expect(reactivada.body).toMatchObject({
        id,
        activo: true,
        fecha: '2026-07-15',
        motivo: 'Mantenimiento ficticio',
        horaInicio: '11:00',
        horaFin: '12:30',
      });

      const filas = (await context!.dataSource.query(
        'SELECT COUNT(*) AS total FROM excepcion_disponibilidad WHERE id = ?',
        [id],
      )) as Array<{ total: number }>;
      expect(Number(filas[0]?.total)).toBe(1);

      const inexistente = await http()
        .patch('/api/disponibilidad/excepciones/00000000-0000-4000-8000-000000000099')
        .send({ activo: false });
      expectApiError(inexistente, 404);
    });
  });

  describe('evaluación y contrato para C-05 (4.9/4.10)', () => {
    const LUNES = '2026-07-13';

    beforeEach(async () => {
      await http()
        .put('/api/disponibilidad/semanales')
        .send({ tramos: [{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' }] })
        .expect(200);
    });

    it('devuelve DISPONIBLE con instantes UTC y FUERA_DE_DISPONIBILIDAD con override manual', async () => {
      const disponible = await http()
        .post('/api/disponibilidad/evaluacion')
        .send({ fecha: LUNES, horaInicio: '10:00', duracionMinutos: 30 })
        .expect(200);
      expect(disponible.body.estado).toBe('DISPONIBLE');
      expect(disponible.body.requiereOverrideManual).toBe(false);
      expect(disponible.body.motivoExcepcion).toBeNull();
      expect(disponible.body.inicioUtc).toBe('2026-07-13T13:00:00.000Z');
      expect(disponible.body.finAtencionUtc).toBe('2026-07-13T13:30:00.000Z');
      expect(disponible.body.finBloqueoUtc).toBe('2026-07-13T13:40:00.000Z');
      expect(Object.keys(disponible.body as object).sort()).toEqual(
        [
          'estado',
          'requiereOverrideManual',
          'motivoExcepcion',
          'tipoExcepcion',
          'inicioUtc',
          'finAtencionUtc',
          'finBloqueoUtc',
        ].sort(),
      );

      const fuera = await http()
        .post('/api/disponibilidad/evaluacion')
        .send({ fecha: LUNES, horaInicio: '18:00', duracionMinutos: 30 })
        .expect(200);
      expect(fuera.body.estado).toBe('FUERA_DE_DISPONIBILIDAD');
      expect(fuera.body.requiereOverrideManual).toBe(true);
    });

    it('aplica excepciones de día completo y parciales con precedencia', async () => {
      await http()
        .post('/api/disponibilidad/excepciones')
        .send({ fecha: LUNES, tipo: 'VACACIONES', motivo: 'Feriado ficticio' })
        .expect(201);
      const total = await http()
        .post('/api/disponibilidad/evaluacion')
        .send({ fecha: LUNES, horaInicio: '10:00', duracionMinutos: 30 })
        .expect(200);
      expect(total.body.estado).toBe('EXCEPCION_BLOQUEANTE');
      expect(total.body.motivoExcepcion).toBe('Feriado ficticio');
      expect(total.body.requiereOverrideManual).toBe(false);

      const id = (
        await http().get('/api/disponibilidad/excepciones').expect(200)
      ).body[0].id as string;
      await http().patch(`/api/disponibilidad/excepciones/${id}`).send({ activo: false }).expect(200);
      await http()
        .post('/api/disponibilidad/excepciones')
        .send({
          fecha: LUNES,
          tipo: 'BLOQUEO',
          motivo: 'Mantenimiento ficticio',
          horaInicio: '11:00',
          horaFin: '12:00',
        })
        .expect(201);

      const libre = await http()
        .post('/api/disponibilidad/evaluacion')
        .send({ fecha: LUNES, horaInicio: '10:00', duracionMinutos: 30 })
        .expect(200);
      expect(libre.body.estado).toBe('DISPONIBLE');

      const cubierta = await http()
        .post('/api/disponibilidad/evaluacion')
        .send({ fecha: LUNES, horaInicio: '11:30', duracionMinutos: 30 })
        .expect(200);
      expect(cubierta.body.estado).toBe('EXCEPCION_BLOQUEANTE');
      expect(cubierta.body.motivoExcepcion).toBe('Mantenimiento ficticio');
    });

    it('devuelve DATOS_INVALIDOS sin lanzar 400 y expone un puerto tipado para C-05', async () => {
      for (const entrada of [
        { fecha: LUNES, horaInicio: '10:00', duracionMinutos: 0 },
        { fecha: '2026-02-30', horaInicio: '10:00', duracionMinutos: 30 },
      ]) {
        const respuesta = await http().post('/api/disponibilidad/evaluacion').send(entrada);
        expect(respuesta.status).toBe(200);
        expect(respuesta.body.estado).toBe('DATOS_INVALIDOS');
      }

      const conIntervalo = await http()
        .post('/api/disponibilidad/evaluacion')
        .send({ fecha: LUNES, horaInicio: '10:00', duracionMinutos: 30, intervaloPosteriorMinutos: 0 })
        .expect(200);
      const sinIntervalo = await http()
        .post('/api/disponibilidad/evaluacion')
        .send({ fecha: LUNES, horaInicio: '10:00', duracionMinutos: 30 })
        .expect(200);
      expect(conIntervalo.body.estado).toBe(sinIntervalo.body.estado);
      expect(conIntervalo.body.finBloqueoUtc).not.toBe(sinIntervalo.body.finBloqueoUtc);

      const puerto = context!.app.get<AvailabilityEvaluationPort>(AVAILABILITY_EVALUATION_PORT);
      const evaluacion: ResultadoEvaluacion = await puerto.evaluar({
        fecha: LUNES,
        horaInicio: '10:00',
        duracionMinutos: 30,
      });
      expect(evaluacion.estado).toBe('DISPONIBLE');
    });
  });

  describe('escrituras concurrentes (4.11)', () => {
    it('no permite que dos reemplazos incompatibles con la misma versión terminen con éxito', async () => {
      const inicial = await http()
        .put('/api/disponibilidad/semanales')
        .send({ tramos: [{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' }] })
        .expect(200);
      const version = inicial.body.version as string;

      const [primera, segunda] = await Promise.all([
        http().put('/api/disponibilidad/semanales').send({
          version,
          tramos: [{ diaSemana: 2, horaInicio: '10:00', horaFin: '12:00' }],
        }),
        http().put('/api/disponibilidad/semanales').send({
          version,
          tramos: [{ diaSemana: 2, horaInicio: '14:00', horaFin: '16:00' }],
        }),
      ]);

      expect([primera.status, segunda.status].sort((a, b) => a - b)).toEqual([200, 409]);
      const ganadora = primera.status === 200 ? primera.body : segunda.body;
      const final = await http().get('/api/disponibilidad/semanales').expect(200);
      expect(final.body.tramos).toEqual(ganadora.tramos);
      expect(final.body.version).toBe(ganadora.version);

      const filas = (await context!.dataSource.query(
        'SELECT COUNT(*) AS total FROM disponibilidad_semanal',
      )) as Array<{ total: number }>;
      expect(Number(filas[0]?.total)).toBe(1);
    });

    it('rechaza una versión obsoleta y acepta la vigente', async () => {
      const primera = await http()
        .put('/api/disponibilidad/semanales')
        .send({ tramos: [{ diaSemana: 4, horaInicio: '09:00', horaFin: '10:00' }] })
        .expect(200);
      const segunda = await http()
        .put('/api/disponibilidad/semanales')
        .send({
          version: primera.body.version,
          tramos: [{ diaSemana: 4, horaInicio: '11:00', horaFin: '12:00' }],
        })
        .expect(200);

      const obsoleta = await http().put('/api/disponibilidad/semanales').send({
        version: primera.body.version,
        tramos: [{ diaSemana: 5, horaInicio: '09:00', horaFin: '10:00' }],
      });
      expectApiError(obsoleta, 409);

      const vigente = await http().put('/api/disponibilidad/semanales').send({
        version: segunda.body.version,
        tramos: [{ diaSemana: 5, horaInicio: '09:00', horaFin: '10:00' }],
      });
      expect(vigente.status).toBe(200);
    });
  });
});
