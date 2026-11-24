import {
  MAX_AGENDA_DAYS,
  addDaysToLocalDate,
  isRealLocalDate,
  isoWeekday,
  resolveAgendaRange,
} from './agenda-range.js';

describe('resolveAgendaRange', () => {
  it('usa desde como hasta cuando no se informa y devuelve un solo día', () => {
    const result = resolveAgendaRange('2027-03-10');
    expect(result).toEqual({ ok: true, range: { desde: '2027-03-10', hasta: '2027-03-10', dias: ['2027-03-10'] } });
  });

  it('acepta el límite de 31 días y rechaza 32', () => {
    const atLimit = resolveAgendaRange('2027-03-01', '2027-03-31');
    expect(atLimit.ok && atLimit.range.dias).toHaveLength(MAX_AGENDA_DAYS);

    expect(resolveAgendaRange('2027-03-01', '2027-04-01')).toEqual({ ok: false, problem: 'TOO_LARGE', requestedDays: 32 });
  });

  it('cuenta los días de forma inclusiva en cruces de mes y de año', () => {
    const crossing = resolveAgendaRange('2026-12-20', '2027-01-19');
    expect(crossing.ok && crossing.range.dias).toHaveLength(31);
    expect(crossing.ok && crossing.range.dias[0]).toBe('2026-12-20');
    expect(crossing.ok && crossing.range.dias[11]).toBe('2026-12-31');
    expect(crossing.ok && crossing.range.dias[12]).toBe('2027-01-01');
    expect(crossing.ok && crossing.range.dias[30]).toBe('2027-01-19');
  });

  it('cuenta el 29 de febrero de un año bisiesto', () => {
    const leap = resolveAgendaRange('2028-02-28', '2028-03-01');
    expect(leap.ok && leap.range.dias).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });

  it('rechaza desde posterior a hasta', () => {
    expect(resolveAgendaRange('2027-03-12', '2027-03-10')).toEqual({ ok: false, problem: 'INVALID' });
  });

  it.each(['2027-02-30', '2027-13-01', '2027-00-10', '2027-04-31', '2027-02-29'])('rechaza la fecha inexistente %s', (fecha) => {
    expect(resolveAgendaRange(fecha)).toEqual({ ok: false, problem: 'INVALID' });
    expect(resolveAgendaRange('2027-03-01', fecha)).toEqual({ ok: false, problem: 'INVALID' });
  });

  it('prioriza el rango inválido sobre el excesivo', () => {
    expect(resolveAgendaRange('2027-06-01', '2027-01-01')).toEqual({ ok: false, problem: 'INVALID' });
  });
});

describe('fechas civiles', () => {
  it('valida el calendario real', () => {
    expect(isRealLocalDate('2028-02-29')).toBe(true);
    expect(isRealLocalDate('2027-02-29')).toBe(false);
    expect(isRealLocalDate('10/03/2027')).toBe(false);
  });

  it('suma días cruzando mes y año', () => {
    expect(addDaysToLocalDate('2027-03-10', 1)).toBe('2027-03-11');
    expect(addDaysToLocalDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToLocalDate('2027-03-01', -1)).toBe('2027-02-28');
  });

  it('calcula el día de la semana ISO (lunes = 1, domingo = 7)', () => {
    expect(isoWeekday('2027-03-08')).toBe(1);
    expect(isoWeekday('2027-03-10')).toBe(3);
    expect(isoWeekday('2027-03-14')).toBe(7);
  });

  it('lanza ante una fecha inexistente en las operaciones que la requieren', () => {
    expect(() => addDaysToLocalDate('2027-02-30', 1)).toThrow(RangeError);
    expect(() => isoWeekday('abc')).toThrow(RangeError);
  });
});
