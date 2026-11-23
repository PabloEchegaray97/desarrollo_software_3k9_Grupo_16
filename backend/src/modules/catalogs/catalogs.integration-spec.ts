import request from 'supertest';
import {
  clearC02Tables,
  expectApiError,
  startIntegrationApp,
  stopIntegrationApp,
  type IntegrationContext,
} from './testing/integration-harness.support-spec.js';

interface ProcedureBody {
  id: string;
  nombre: string;
  duracionPredeterminadaMinutos: number;
  intervaloPosteriorMinutos: number | null;
  activo: boolean;
}

interface ListBody<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

describe('Catálogos de prestaciones y sillones (integración MariaDB)', () => {
  let context: IntegrationContext | undefined;
  const http = () => {
    const client = request(context!.app.getHttpServer());
    const authenticated = (testRequest: request.Test) =>
      testRequest.set('Cookie', context!.sessionCookie);
    return {
      delete: (url: string) => authenticated(client.delete(url)),
      get: (url: string) => authenticated(client.get(url)),
      patch: (url: string) => authenticated(client.patch(url)),
      post: (url: string) => authenticated(client.post(url)),
      put: (url: string) => authenticated(client.put(url)),
    };
  };

  beforeAll(async () => {
    context = await startIntegrationApp();
  });

  afterAll(async () => {
    await stopIntegrationApp(context);
  });

  beforeEach(async () => {
    await clearC02Tables(context!.dataSource);
  });

  const createProcedure = (body: Record<string, unknown>) => http().post('/api/prestaciones').send(body);

  it('crea prestaciones activas y guarda null cuando no hay intervalo propio', async () => {
    const withInterval = await createProcedure({ nombre: '  Control   ficticio ', duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: 5 });
    const withoutInterval = await createProcedure({ nombre: 'Limpieza ficticia', duracionPredeterminadaMinutos: 45 });

    expect(withInterval.status).toBe(201);
    expect(withInterval.body).toMatchObject({ nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: 5, activo: true });
    expect(withoutInterval.status).toBe(201);
    expect((withoutInterval.body as ProcedureBody).intervaloPosteriorMinutos).toBeNull();
  });

  it.each([
    [{ duracionPredeterminadaMinutos: 1 }, 201],
    [{ duracionPredeterminadaMinutos: 240 }, 201],
    [{ duracionPredeterminadaMinutos: 0 }, 400],
    [{ duracionPredeterminadaMinutos: 241 }, 400],
    [{ duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: 0 }, 201],
    [{ duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: 30 }, 201],
    [{ duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: -1 }, 400],
    [{ duracionPredeterminadaMinutos: 30, intervaloPosteriorMinutos: 31 }, 400],
  ])('aplica los límites de duración e intervalo %p → %i', async (values, status) => {
    const response = await createProcedure({ nombre: 'Prestación de límite ficticia', ...values });
    if (status === 400) expectApiError(response, 400, 'VALIDATION_ERROR');
    else expect(response.status).toBe(201);
  });

  it('el CHECK de la base rechaza rangos inválidos aunque se salte la API', async () => {
    await expect(
      context!.dataSource.query(
        "INSERT INTO procedures (id, name, default_duration_minutes) VALUES ('00000000-0000-4000-8000-000000000001', 'Fuera de rango ficticia', 241)",
      ),
    ).rejects.toThrow();
  });

  it('rechaza un nombre de prestación repetido sin distinguir mayúsculas ni espacios', async () => {
    await createProcedure({ nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30 });
    const duplicate = await createProcedure({ nombre: '  control FICTICIO ', duracionPredeterminadaMinutos: 20 });
    expectApiError(duplicate, 409, 'PROCEDURE_NAME_CONFLICT');
  });

  it('rechaza un sillón con el nombre de otro inactivo y permite reactivarlo', async () => {
    const created = await http().post('/api/sillones').send({ nombre: 'Sillón 2' });
    await http().patch(`/api/sillones/${created.body.id}/estado`).send({ activo: false }).expect(200);

    const duplicate = await http().post('/api/sillones').send({ nombre: 'Sillón 2' });
    const reactivated = await http().patch(`/api/sillones/${created.body.id}/estado`).send({ activo: true });

    expect(reactivated.status).toBe(200);
    expect(reactivated.body).toMatchObject({ nombre: 'Sillón 2', activo: true });
    expectApiError(duplicate, 409, 'CHAIR_NAME_CONFLICT');
  });

  it('permite el mismo nombre en catálogos distintos', async () => {
    expect((await createProcedure({ nombre: 'Compartido ficticio', duracionPredeterminadaMinutos: 30 })).status).toBe(201);
    expect((await http().post('/api/sillones').send({ nombre: 'Compartido ficticio' })).status).toBe(201);
  });

  it('lista solo activos ordenados por nombre y paginados; incluye inactivos a pedido', async () => {
    for (const nombre of ['Sillón 3', 'Sillón 1', 'Sillón 2']) {
      await http().post('/api/sillones').send({ nombre }).expect(201);
    }
    const all = await http().get('/api/sillones').expect(200);
    const inactive = (all.body as ListBody<ProcedureBody>).items.find((item) => item.nombre === 'Sillón 2');
    await http().patch(`/api/sillones/${inactive?.id}/estado`).send({ activo: false }).expect(200);

    const actives = await http().get('/api/sillones').expect(200);
    const withInactive = await http().get('/api/sillones?incluirInactivos=true&pageSize=2&page=2').expect(200);

    expect((actives.body as ListBody<ProcedureBody>).items.map((item) => item.nombre)).toEqual(['Sillón 1', 'Sillón 3']);
    expect(withInactive.body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect((withInactive.body as ListBody<ProcedureBody>).items.map((item) => item.nombre)).toEqual(['Sillón 3']);
  });

  it('filtra por nombre parcial y escapa comodines', async () => {
    await createProcedure({ nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30 });
    await createProcedure({ nombre: 'Limpieza ficticia', duracionPredeterminadaMinutos: 45 });

    const filtered = await http().get('/api/prestaciones?q=limp').expect(200);
    const wildcard = await http().get('/api/prestaciones?q=%25').expect(200);

    expect((filtered.body as ListBody<ProcedureBody>).items.map((item) => item.nombre)).toEqual(['Limpieza ficticia']);
    expect(wildcard.body).toMatchObject({ items: [], total: 0 });
  });

  it('responde un catálogo vacío con items [] y total 0', async () => {
    const response = await http().get('/api/prestaciones').expect(200);
    expect(response.body).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('desactivar conserva el registro por id y editar no toca otras filas', async () => {
    const control = await createProcedure({ nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30 });
    const other = await createProcedure({ nombre: 'Limpieza ficticia', duracionPredeterminadaMinutos: 45 });

    await http().patch(`/api/prestaciones/${control.body.id}/estado`).send({ activo: false }).expect(200);
    const edited = await http()
      .put(`/api/prestaciones/${control.body.id}`)
      .send({ nombre: 'Control ficticio', duracionPredeterminadaMinutos: 50 })
      .expect(200);
    const untouched = await http().get(`/api/prestaciones/${other.body.id}`).expect(200);

    expect(edited.body).toMatchObject({ duracionPredeterminadaMinutos: 50, activo: false });
    expect(untouched.body).toEqual(other.body);
  });

  it('no expone borrado y responde 404 de dominio para ids inexistentes', async () => {
    const created = await http().post('/api/sillones').send({ nombre: 'Sillón 1' });
    await http().delete(`/api/sillones/${created.body.id}`).expect(404);
    await http().get(`/api/sillones/${created.body.id}`).expect(200);

    const missing = await http().get('/api/prestaciones/00000000-0000-4000-8000-0000000000ff');
    expectApiError(missing, 404, 'PROCEDURE_NOT_FOUND');
  });
});
