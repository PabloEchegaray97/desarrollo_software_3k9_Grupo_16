import { evaluarIntervalo } from '../../../availability/domain/availability-policy.js';
import {
  blockedPeriod,
  classifyConflicts,
  periodsConflict,
  resolveEffectiveTimes,
  type ScheduledAppointment,
} from './appointment-policy.js';
import { APPOINTMENT_STATUSES, BLOCKING_STATUSES, isBlockingStatus, type AppointmentStatus } from './appointment-status.js';

const at = (iso: string): Date => new Date(iso);
const CHAIR_1 = 'chair-1';
const CHAIR_2 = 'chair-2';

function scheduled(id: string, startsAt: string, blockEndsAt: string, overrides: Partial<ScheduledAppointment> = {}): ScheduledAppointment {
  return { id, chairId: CHAIR_1, status: 'PROGRAMADO', startsAt: at(startsAt), blockEndsAt: at(blockEndsAt), ...overrides };
}

describe('resolveEffectiveTimes (RN-PR-05/06)', () => {
  const base = { procedureDurationMinutes: 30, procedureIntervalMinutes: 5, globalIntervalMinutes: 10 };

  it('usa duración e intervalo de la prestación sin sobrescrituras', () => {
    expect(resolveEffectiveTimes(base)).toEqual({ durationMinutes: 30, postIntervalMinutes: 5 });
  });

  it('usa el intervalo global cuando la prestación no define uno', () => {
    expect(resolveEffectiveTimes({ ...base, procedureIntervalMinutes: null })).toEqual({ durationMinutes: 30, postIntervalMinutes: 10 });
  });

  it('la sobrescritura del turno prevalece, incluido un intervalo 0', () => {
    expect(resolveEffectiveTimes({ ...base, overrideDurationMinutes: 50, overrideIntervalMinutes: 0 })).toEqual({
      durationMinutes: 50,
      postIntervalMinutes: 0,
    });
    expect(resolveEffectiveTimes({ ...base, procedureIntervalMinutes: null, overrideIntervalMinutes: 0 }).postIntervalMinutes).toBe(0);
  });

  it('acepta los límites 1/240 y 0/30', () => {
    expect(resolveEffectiveTimes({ ...base, overrideDurationMinutes: 1, overrideIntervalMinutes: 30 })).toEqual({ durationMinutes: 1, postIntervalMinutes: 30 });
    expect(resolveEffectiveTimes({ ...base, overrideDurationMinutes: 240 }).durationMinutes).toBe(240);
  });
});

describe('blockedPeriod (RN-TU-01)', () => {
  it('suma duración e intervalo al inicio', () => {
    expect(blockedPeriod(at('2027-03-10T13:00:00.000Z'), { durationMinutes: 30, postIntervalMinutes: 5 })).toEqual({
      startsAt: at('2027-03-10T13:00:00.000Z'),
      careEndsAt: at('2027-03-10T13:30:00.000Z'),
      blockEndsAt: at('2027-03-10T13:35:00.000Z'),
    });
  });

  it('coincide con los instantes UTC que calcula la evaluación de C-03', () => {
    const evaluation = evaluarIntervalo({
      fecha: '2027-03-10',
      horaInicio: '10:00',
      duracionMinutos: 45,
      intervaloPosteriorMinutos: 15,
      zonaHoraria: 'America/Argentina/Buenos_Aires',
      tramos: [{ diaSemana: 3, horaInicio: '09:00', horaFin: '13:00' }],
    });
    const period = blockedPeriod(at(evaluation.inicioUtc ?? ''), { durationMinutes: 45, postIntervalMinutes: 15 });

    expect(evaluation.estado).toBe('DISPONIBLE');
    expect(period.startsAt.toISOString()).toBe('2027-03-10T13:00:00.000Z');
    expect(period.careEndsAt.toISOString()).toBe(evaluation.finAtencionUtc);
    expect(period.blockEndsAt.toISOString()).toBe(evaluation.finBloqueoUtc);
  });
});

describe('periodsConflict (RN-TU-02, intervalo semiabierto)', () => {
  const existing = { startsAt: at('2027-03-10T13:00:00Z'), blockEndsAt: at('2027-03-10T13:40:00Z') };

  it.each([
    ['contiguo después: empieza justo en finBloqueo', '2027-03-10T13:40:00Z', '2027-03-10T14:10:00Z', false],
    ['contiguo antes: termina justo al empezar el otro', '2027-03-10T12:20:00Z', '2027-03-10T13:00:00Z', false],
    ['empieza dentro del intervalo posterior', '2027-03-10T13:35:00Z', '2027-03-10T14:05:00Z', true],
    ['su bloqueo alcanza al siguiente', '2027-03-10T12:30:00Z', '2027-03-10T13:05:00Z', true],
    ['contiene al existente', '2027-03-10T12:00:00Z', '2027-03-10T15:00:00Z', true],
    ['contenido en el existente', '2027-03-10T13:10:00Z', '2027-03-10T13:20:00Z', true],
    ['mismo período', '2027-03-10T13:00:00Z', '2027-03-10T13:40:00Z', true],
    ['totalmente posterior', '2027-03-10T15:00:00Z', '2027-03-10T15:30:00Z', false],
  ])('%s → %s', (_label, startsAt, blockEndsAt, expected) => {
    const candidate = { startsAt: at(startsAt), blockEndsAt: at(blockEndsAt) };
    expect(periodsConflict(candidate, existing)).toBe(expected);
    expect(periodsConflict(existing, candidate)).toBe(expected);
  });
});

describe('estados bloqueantes (RN-TU-07)', () => {
  it('bloquean todos salvo CANCELADO', () => {
    expect(APPOINTMENT_STATUSES.filter(isBlockingStatus)).toEqual(['PROGRAMADO', 'CONFIRMADO', 'ATENDIDO', 'AUSENTE']);
    expect(BLOCKING_STATUSES).not.toContain('CANCELADO');
  });
});

describe('classifyConflicts (RN-TU-03/04)', () => {
  const candidate = { startsAt: at('2027-03-10T13:15:00Z'), blockEndsAt: at('2027-03-10T13:55:00Z') };

  it('sin turnos existentes no hay conflicto', () => {
    expect(classifyConflicts(candidate, CHAIR_1, [])).toBeNull();
  });

  it('un turno en otro sillón es conflicto del odontólogo', () => {
    const report = classifyConflicts(candidate, CHAIR_2, [scheduled('a', '2027-03-10T13:00:00Z', '2027-03-10T13:40:00Z')]);
    expect(report?.scope).toBe('ODONTOLOGO');
    expect(report?.conflicts.map((item) => item.id)).toEqual(['a']);
  });

  it('si alguno usa el mismo sillón el alcance es SILLON', () => {
    const report = classifyConflicts(candidate, CHAIR_1, [
      scheduled('otro', '2027-03-10T13:00:00Z', '2027-03-10T13:20:00Z', { chairId: CHAIR_2 }),
      scheduled('mismo', '2027-03-10T13:30:00Z', '2027-03-10T14:00:00Z'),
    ]);
    expect(report?.scope).toBe('SILLON');
    expect(report?.conflicts.map((item) => item.id)).toEqual(['otro', 'mismo']);
  });

  it.each<[AppointmentStatus, boolean]>([
    ['PROGRAMADO', true],
    ['CONFIRMADO', true],
    ['ATENDIDO', true],
    ['AUSENTE', true],
    ['CANCELADO', false],
  ])('un turno %s en el mismo horario bloquea: %s', (status, blocks) => {
    const report = classifyConflicts(candidate, CHAIR_1, [scheduled('a', '2027-03-10T13:00:00Z', '2027-03-10T13:40:00Z', { status })]);
    expect(report !== null).toBe(blocks);
  });

  it('ignora turnos contiguos y el turno excluido (reprogramación de C-06)', () => {
    const existing = [
      scheduled('antes', '2027-03-10T12:35:00Z', '2027-03-10T13:15:00Z'),
      scheduled('despues', '2027-03-10T13:55:00Z', '2027-03-10T14:30:00Z'),
      scheduled('propio', '2027-03-10T13:15:00Z', '2027-03-10T13:55:00Z'),
    ];
    expect(classifyConflicts(candidate, CHAIR_1, existing, 'propio')).toBeNull();
    expect(classifyConflicts(candidate, CHAIR_1, existing)?.conflicts.map((item) => item.id)).toEqual(['propio']);
  });
});
