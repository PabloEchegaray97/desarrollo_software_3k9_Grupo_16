/** Rango máximo consultable en una solicitud de agenda, en días calendario inclusive (P2-02). */
export const MAX_AGENDA_DAYS = 31;

const MS_PER_DAY = 86_400_000;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

export interface AgendaRange {
  readonly desde: string;
  readonly hasta: string;
  /** Todas las fechas locales del rango, en orden cronológico. */
  readonly dias: readonly string[];
}

export type AgendaRangeResult =
  | { readonly ok: true; readonly range: AgendaRange }
  | { readonly ok: false; readonly problem: 'INVALID' }
  | { readonly ok: false; readonly problem: 'TOO_LARGE'; readonly requestedDays: number };

/** Instante UTC de la medianoche de una fecha civil `YYYY-MM-DD`, o `null` si la fecha no existe. */
function civilDateToMillis(fecha: string): number | null {
  const parts = LOCAL_DATE.exec(fecha);
  if (parts === null) {
    return null;
  }
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const millis = Date.UTC(year, month - 1, day);
  const date = new Date(millis);
  const exists =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return exists ? millis : null;
}

function millisToCivilDate(millis: number): string {
  return new Date(millis).toISOString().slice(0, 10);
}

/** `true` si la fecha tiene formato `YYYY-MM-DD` y existe en el calendario. */
export function isRealLocalDate(fecha: string): boolean {
  return civilDateToMillis(fecha) !== null;
}

/** Suma días a una fecha civil. Lanza si la fecha no existe: el llamador valida antes. */
export function addDaysToLocalDate(fecha: string, days: number): string {
  const millis = civilDateToMillis(fecha);
  if (millis === null) {
    throw new RangeError('La fecha local no existe en el calendario');
  }
  return millisToCivilDate(millis + days * MS_PER_DAY);
}

/** Día de la semana ISO de una fecha civil: 1 = lunes … 7 = domingo. */
export function isoWeekday(fecha: string): number {
  const millis = civilDateToMillis(fecha);
  if (millis === null) {
    throw new RangeError('La fecha local no existe en el calendario');
  }
  const weekday = new Date(millis).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/**
 * Valida el rango pedido. `hasta` por defecto es `desde`. Ambas fechas son inclusivas.
 * No usa zona horaria: opera sobre fechas civiles del consultorio.
 */
export function resolveAgendaRange(desde: string, hasta?: string): AgendaRangeResult {
  const end = hasta ?? desde;
  const startMillis = civilDateToMillis(desde);
  const endMillis = civilDateToMillis(end);
  if (startMillis === null || endMillis === null || startMillis > endMillis) {
    return { ok: false, problem: 'INVALID' };
  }

  const requestedDays = Math.round((endMillis - startMillis) / MS_PER_DAY) + 1;
  if (requestedDays > MAX_AGENDA_DAYS) {
    return { ok: false, problem: 'TOO_LARGE', requestedDays };
  }

  const dias: string[] = [];
  for (let offset = 0; offset < requestedDays; offset += 1) {
    dias.push(millisToCivilDate(startMillis + offset * MS_PER_DAY));
  }
  return { ok: true, range: { desde, hasta: end, dias } };
}
