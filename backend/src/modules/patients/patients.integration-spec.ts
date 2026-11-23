import request from 'supertest';
import {
  clearC02Tables,
  expectApiError,
  startIntegrationApp,
  stopIntegrationApp,
  type IntegrationContext,
} from '../catalogs/testing/integration-harness.support-spec.js';
import { fictionalDni, fictionalEmail, fictionalPatient } from './testing/fictional-patients.support-spec.js';

interface PatientBody {
  id: string;
  nombre: string;
  telefono: string;
  dni: string | null;
  email: string | null;
  activo: boolean;
}

interface ListBody {
  items: PatientBody[];
  page: number;
  pageSize: number;
  total: number;
}

describe('Registro de pacientes (integración MariaDB)', () => {
  let context: IntegrationContext | undefined;
  const http = () => request(context!.app.getHttpServer());
  const create = (body: object) => http().post('/api/pacientes').send(body);
  const names = (response: request.Response) => (response.body as ListBody).items.map((item) => item.nombre);

  beforeAll(async () => {
    context = await startIntegrationApp();
  });

  afterAll(async () => {
    await stopIntegrationApp(context);
  });

  beforeEach(async () => {
    await clearC02Tables(context!.dataSource);
  });

  it('registra con datos mínimos y normaliza nombre, DNI y email', async () => {
    const minimal = await create(fictionalPatient(1, { nombre: '  Paciente   Ficticio  Uno ' }));
    const complete = await create(fictionalPatient(2, { dni: '30.000.002', email: ' Paciente2@Example.TEST ' }));

    expect(minimal.status).toBe(201);
    expect(minimal.body).toMatchObject({ nombre: 'Paciente Ficticio Uno', dni: null, email: null, activo: true });
    expect(complete.body).toMatchObject({ dni: fictionalDni(2), email: fictionalEmail(2) });
  });

  it.each([
    [{ telefono: '11 5555-0001' }],
    [{ nombre: 'Paciente Ficticio 1' }],
    [fictionalPatient(1, { email: 'no-es-un-email' })],
    [fictionalPatient(1, { telefono: 'llamar al consultorio' })],
    [fictionalPatient(1, { dni: '12A45' })],
  ])('rechaza datos inválidos %p sin crear nada', async (body) => {
    expectApiError(await create(body), 400, 'VALIDATION_ERROR');
    expect((await http().get('/api/pacientes?incluirInactivos=true')).body).toMatchObject({ total: 0 });
  });

  it('permite varios pacientes sin DNI', async () => {
    expect((await create(fictionalPatient(1))).status).toBe(201);
    expect((await create(fictionalPatient(2))).status).toBe(201);
  });

  it('rechaza un DNI repetido escrito con otro formato', async () => {
    await create(fictionalPatient(1, { dni: fictionalDni(1) })).expect(201);
    expectApiError(await create(fictionalPatient(2, { dni: '30.000.001' })), 409, 'PATIENT_DNI_CONFLICT');
  });

  it('vuelve a comprobar la unicidad de DNI al editar', async () => {
    await create(fictionalPatient(1, { dni: fictionalDni(1) })).expect(201);
    const other = await create(fictionalPatient(2)).expect(201);

    const edited = await http().put(`/api/pacientes/${other.body.id}`).send(fictionalPatient(2, { dni: fictionalDni(1) }));
    const unchanged = await http().get(`/api/pacientes/${other.body.id}`).expect(200);

    expect(unchanged.body).toMatchObject({ dni: null });
    expectApiError(edited, 409, 'PATIENT_DNI_CONFLICT');
  });

  it('dos altas concurrentes con el mismo DNI: exactamente una se completa', async () => {
    const responses = await Promise.all(
      [1, 2, 3, 4, 5].map((index) => create(fictionalPatient(index, { dni: fictionalDni(7) }))),
    );
    const statuses = responses.map((response) => response.status).sort((left, right) => left - right);
    const [{ total }] = (await context!.dataSource.query(
      "SELECT COUNT(*) AS total FROM patients WHERE dni = '30000007'",
    )) as Array<{ total: string | number }>;

    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(Number(total)).toBe(1);
    for (const rejected of responses.filter((response) => response.status === 409)) {
      expectApiError(rejected, 409, 'PATIENT_DNI_CONFLICT');
    }
  });

  it('advierte un posible duplicado y lo registra al confirmar', async () => {
    const existing = await create(fictionalPatient(1, { dni: fictionalDni(1), email: fictionalEmail(1) })).expect(201);
    const duplicate = { nombre: 'paciente ficticio 1', telefono: '1155550001' };

    const warning = await create(duplicate);
    const totalAfterWarning = (await http().get('/api/pacientes')).body as ListBody;
    const confirmed = await create({ ...duplicate, confirmarPosibleDuplicado: true });

    expect(totalAfterWarning.total).toBe(1);
    expect(confirmed.status).toBe(201);
    expect(confirmed.body).not.toHaveProperty('confirmarPosibleDuplicado');
    expectApiError(warning, 409, 'PATIENT_POSSIBLE_DUPLICATE');
    // Candidatos mínimos: sin teléfono, DNI ni email (requiere también CR-01 para `details`).
    expect(warning.body.error.details).toEqual({
      candidatos: [{ id: existing.body.id, nombre: 'Paciente Ficticio 1', activo: true }],
    });
  });

  it('un teléfono compartido con otro nombre no genera advertencia', async () => {
    await create(fictionalPatient(1)).expect(201);
    await create(fictionalPatient(9, { telefono: '11 5555-0001' })).expect(201);
  });

  it('editar solo el email de un paciente que coincide con otro no pide confirmación', async () => {
    await create(fictionalPatient(1)).expect(201);
    const twin = await create({ ...fictionalPatient(1), confirmarPosibleDuplicado: true }).expect(201);

    const edited = await http().put(`/api/pacientes/${twin.body.id}`).send(fictionalPatient(1, { email: fictionalEmail(1) }));

    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ email: fictionalEmail(1) });
  });

  it('busca por nombre parcial, teléfono o DNI con formato libre', async () => {
    await create(fictionalPatient(1, { dni: fictionalDni(1) })).expect(201);
    await create(fictionalPatient(2)).expect(201);
    await create({ nombre: 'Otra Persona Ficticia', telefono: '11 5555-0099' }).expect(201);

    expect(names(await http().get('/api/pacientes?q=ficticio 1'))).toEqual(['Paciente Ficticio 1']);
    expect(names(await http().get('/api/pacientes?q=5555-0002'))).toEqual(['Paciente Ficticio 2']);
    expect(names(await http().get('/api/pacientes?q=30.000.001'))).toEqual(['Paciente Ficticio 1']);
    expect(names(await http().get('/api/pacientes?q=Ficticia'))).toEqual(['Otra Persona Ficticia']);
  });

  it('rechaza paginación inválida y aplica los valores por defecto', async () => {
    expectApiError(await http().get('/api/pacientes?pageSize=500'), 400, 'VALIDATION_ERROR');
    expectApiError(await http().get('/api/pacientes?page=0'), 400, 'VALIDATION_ERROR');
    expect((await http().get('/api/pacientes')).body).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('desactivar oculta del listado por defecto pero conserva el paciente', async () => {
    const created = await create(fictionalPatient(1, { dni: fictionalDni(1) })).expect(201);
    await http().patch(`/api/pacientes/${created.body.id}/estado`).send({ activo: false }).expect(200);

    expect((await http().get('/api/pacientes')).body).toMatchObject({ total: 0 });
    expect(names(await http().get('/api/pacientes?incluirInactivos=true'))).toEqual(['Paciente Ficticio 1']);
    expect((await http().get(`/api/pacientes/${created.body.id}`)).body).toMatchObject({ activo: false, dni: fictionalDni(1) });
    // El DNI de un paciente inactivo sigue reservado.
    expectApiError(await create(fictionalPatient(2, { dni: fictionalDni(1) })), 409, 'PATIENT_DNI_CONFLICT');
  });

  it('no expone borrado y responde 404 de dominio para ids inexistentes', async () => {
    const created = await create(fictionalPatient(1)).expect(201);
    await http().delete(`/api/pacientes/${created.body.id}`).expect(404);
    await http().get(`/api/pacientes/${created.body.id}`).expect(200);
    expectApiError(await http().get('/api/pacientes/00000000-0000-4000-8000-0000000000ff'), 404, 'PATIENT_NOT_FOUND');
  });

  it('la migración C02 se revierte y se vuelve a aplicar', async () => {
    const dataSource = context!.dataSource;
    const c02Tables = async () =>
      ((await dataSource.query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('patients','procedures','chairs')",
      )) as unknown[]).length;

    await dataSource.undoLastMigration({ transaction: 'all' });
    const afterDown = await c02Tables();
    await dataSource.runMigrations({ transaction: 'all' });

    expect(afterDown).toBe(0);
    expect(await c02Tables()).toBe(3);
  });
});
