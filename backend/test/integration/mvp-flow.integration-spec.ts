import {
  clearLifecycleAppointments,
  seedLifecycleFixtures,
  startLifecycleApi,
  stopLifecycleApi,
  type LifecycleApiContext,
  type LifecycleFixtures,
} from '../../src/modules/appointments/lifecycle/testing/appointment-lifecycle-api.support-spec.js';
import { authenticated, loginForMvp, MVP_DATE } from './mvp-flow.support-spec.js';

interface AppointmentBody {
  id: string;
  estado: string;
  inicio: string;
  finAtencion: string;
  sillonId: string;
}

interface AgendaBody {
  fecha: string;
  turnos: Array<{ id: string; estado: string }>;
}

describe('Recorrido MVP C-08 (MariaDB real)', () => {
  let context: LifecycleApiContext | undefined;
  let fixtures: LifecycleFixtures;

  beforeAll(async () => {
    context = await startLifecycleApi();
    fixtures = await seedLifecycleFixtures(context);
  });

  afterAll(async () => {
    await stopLifecycleApi(context);
  });

  beforeEach(async () => {
    await clearLifecycleAppointments(context!.db);
  });

  it('recorre login, catálogos, disponibilidad, alta, agenda y ciclo de vida', async () => {
    const { cookie } = await loginForMvp(context!);
    const http = authenticated(context!, cookie);

    const patients = await http.get('/pacientes').expect(200);
    expect((patients.body as { items: unknown[] }).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nombre: 'Paciente Ficticio C06 Uno', activo: true }),
      ]),
    );

    const procedures = await http.get('/prestaciones').expect(200);
    expect((procedures.body as { items: unknown[] }).items).not.toEqual([]);
    const chairs = await http.get('/sillones').expect(200);
    expect((chairs.body as { items: unknown[] }).items).not.toEqual([]);

    await http
      .put('/disponibilidad/semanales', {
        tramos: [{ diaSemana: 3, horaInicio: '09:00', horaFin: '13:00' }],
      })
      .expect(200);
    const availability = await http.get('/disponibilidad/semanales').expect(200);
    expect(availability.body).toMatchObject({
      tramos: expect.arrayContaining([
        expect.objectContaining({ diaSemana: 3, horaInicio: '09:00', horaFin: '13:00' }),
      ]),
    });

    const created = await http
      .post('/turnos', {
        pacienteId: fixtures.patientId,
        prestacionId: fixtures.procedureId,
        sillonId: fixtures.chair1Id,
        fecha: MVP_DATE,
        horaInicio: '10:00',
      })
      .expect(201);
    const appointment = created.body as AppointmentBody;
    expect(appointment).toMatchObject({ estado: 'PROGRAMADO', sillonId: fixtures.chair1Id });

    const agenda = await http
      .get(`/agenda?desde=${MVP_DATE}&hasta=${MVP_DATE}&sillonId=${fixtures.chair1Id}`)
      .expect(200);
    const agendaBody = agenda.body as AgendaBody;
    expect(agendaBody.turnos).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: appointment.id, estado: 'PROGRAMADO' })]),
    );

    const reprogrammed = await http
      .patch(`/turnos/${appointment.id}/reprogramar`, {
        fecha: MVP_DATE,
        horaInicio: '11:00',
        motivo: 'Reprogramación ficticia C-08',
      })
      .expect(200);
    expect(reprogrammed.body).toMatchObject({
      turno: expect.objectContaining({ estado: 'PROGRAMADO', sillonId: fixtures.chair1Id }),
    });

    await http
      .patch(`/turnos/${appointment.id}/estado`, { estado: 'CONFIRMADO' })
      .expect(200);

    await http
      .patch(`/turnos/${appointment.id}/cancelar`, { motivo: 'Cancelación ficticia C-08' })
      .expect(200);

    const history = await http
      .get(`/turnos/${appointment.id}/historial`)
      .expect(200);
    const historyBody = history.body as {
      turnoId: string;
      eventos: Array<{ tipo: string; estadoNuevo: string | null }>;
    };
    expect(historyBody.turnoId).toBe(appointment.id);
    expect(historyBody.eventos.map((event) => event.tipo)).toEqual(
      expect.arrayContaining(['CREADO', 'REPROGRAMADO', 'CAMBIO_ESTADO', 'CANCELADO']),
    );
    expect(historyBody.eventos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: 'CAMBIO_ESTADO', estadoNuevo: 'CONFIRMADO' }),
        expect.objectContaining({ tipo: 'CANCELADO', estadoNuevo: 'CANCELADO' }),
      ]),
    );

    const eventRows = (await context!.db.query(
      'SELECT COUNT(*) AS total FROM appointment_events WHERE appointment_id = ?',
      [appointment.id],
    )) as Array<{ total: string }>;
    expect(Number(eventRows[0].total)).toBeGreaterThanOrEqual(4);

    const isolated = await http
      .get(`/agenda?desde=${MVP_DATE}&hasta=${MVP_DATE}`)
      .expect(200);
    expect(isolated.body).toEqual(
      expect.objectContaining({
        dias: expect.arrayContaining([expect.objectContaining({ fecha: MVP_DATE })]),
      }),
    );
  });
});
