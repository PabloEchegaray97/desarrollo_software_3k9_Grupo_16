import type { AppointmentStatus } from '../../core/domain/appointment-status.js';
import {
  ALLOWED_TRANSITIONS,
  RESCHEDULABLE_STATUSES,
  TERMINAL_STATUSES,
  assertReschedulable,
  assertTransition,
  isReschedulable,
  isStatusObserved,
  isTerminalStatus,
} from './appointment-transitions.js';

const ALL_STATUSES: readonly AppointmentStatus[] = ['PROGRAMADO', 'CONFIRMADO', 'ATENDIDO', 'AUSENTE', 'CANCELADO'];

describe('assertTransition (RN-TU-13/14/17)', () => {
  it('permite PROGRAMADO → CONFIRMADO', () => {
    expect(assertTransition('PROGRAMADO', 'CONFIRMADO')).toEqual({ ok: true });
  });

  it.each<[AppointmentStatus, AppointmentStatus]>([
    ['PROGRAMADO', 'ATENDIDO'],
    ['PROGRAMADO', 'AUSENTE'],
    ['PROGRAMADO', 'CANCELADO'],
    ['CONFIRMADO', 'ATENDIDO'],
    ['CONFIRMADO', 'AUSENTE'],
    ['CONFIRMADO', 'CANCELADO'],
  ])('permite la arista %s → %s', (from, to) => {
    expect(assertTransition(from, to)).toEqual({ ok: true });
  });

  it.each<[AppointmentStatus, AppointmentStatus]>([
    ['PROGRAMADO', 'PROGRAMADO'],
    ['CONFIRMADO', 'CONFIRMADO'],
    ['CONFIRMADO', 'PROGRAMADO'],
    ['ATENDIDO', 'PROGRAMADO'],
    ['AUSENTE', 'CONFIRMADO'],
    ['CANCELADO', 'ATENDIDO'],
  ])('rechaza la arista %s → %s', (from, to) => {
    expect(assertTransition(from, to)).toEqual({ ok: false, reason: 'INVALID_TRANSITION' });
  });

  it.each(TERMINAL_STATUSES)('trata %s como terminal hacia cualquier destino', (from) => {
    for (const to of ALL_STATUSES) {
      expect(assertTransition(from, to)).toEqual({ ok: false, reason: 'INVALID_TRANSITION' });
    }
  });

  it('la matriz contiene exactamente las siete aristas aprobadas', () => {
    expect(ALLOWED_TRANSITIONS.PROGRAMADO).toEqual(['CONFIRMADO', 'ATENDIDO', 'AUSENTE', 'CANCELADO']);
    expect(ALLOWED_TRANSITIONS.CONFIRMADO).toEqual(['ATENDIDO', 'AUSENTE', 'CANCELADO']);
    expect(ALLOWED_TRANSITIONS.ATENDIDO).toEqual([]);
    expect(ALLOWED_TRANSITIONS.AUSENTE).toEqual([]);
    expect(ALLOWED_TRANSITIONS.CANCELADO).toEqual([]);
  });
});

describe('res reprogramables (RN-TU-17)', () => {
  it.each(RESCHEDULABLE_STATUSES)('permite reprogramar %s', (status) => {
    expect(isReschedulable(status)).toBe(true);
    expect(assertReschedulable(status)).toEqual({ ok: true });
  });

  it.each(TERMINAL_STATUSES)('rechaza reprogramar %s', (status) => {
    expect(isTerminalStatus(status)).toBe(true);
    expect(assertReschedulable(status)).toEqual({ ok: false, reason: 'NOT_RESCHEDULABLE' });
  });
});

describe('isStatusObserved (RN-TU-16)', () => {
  const startsAt = new Date('2027-03-10T13:00:00.000Z');

  it('rechaza un instante 1 ms antes del inicio', () => {
    expect(isStatusObserved(new Date(startsAt.getTime() - 1), startsAt)).toBe(false);
  });

  it('acepta el instante exacto del inicio y uno posterior', () => {
    expect(isStatusObserved(startsAt, startsAt)).toBe(true);
    expect(isStatusObserved(new Date('2027-03-10T13:00:01.000Z'), startsAt)).toBe(true);
  });

  it('compara UTC sin depender del offset local del proceso', () => {
    const localInicio = new Date('2027-03-10T10:00:00.000-03:00');
    expect(localInicio.toISOString()).toBe(startsAt.toISOString());
    expect(isStatusObserved(new Date('2027-03-10T09:59:59.999Z'), localInicio)).toBe(false);
    expect(isStatusObserved(new Date('2027-03-10T10:00:00.000-03:00'), localInicio)).toBe(true);
  });
});
