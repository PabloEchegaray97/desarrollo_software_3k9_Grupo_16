/**
 * Formato y navegación de fechas en la zona del consultorio. La interfaz solo presenta instantes
 * que decide el backend. Copia mínima de `appointments/create/time.ts`: `shared/` no es editable
 * desde C-07; C-08 puede unificarlas.
 */
export const CLINIC_TIME_ZONE = 'America/Argentina/Buenos_Aires'

const MS_PER_DAY = 86_400_000
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const todayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// La fecha civil se formatea sobre el mediodía UTC para que ninguna zona la corra de día.
const civilDateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** Milisegundos UTC del mediodía de una fecha civil `YYYY-MM-DD`, o `null` si no existe en el calendario. */
function civilNoon(fecha: string): number | null {
  const parts = LOCAL_DATE.exec(fecha)
  if (!parts) return null
  const year = Number(parts[1])
  const month = Number(parts[2])
  const day = Number(parts[3])
  const millis = Date.UTC(year, month - 1, day, 12)
  const date = new Date(millis)
  const exists = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return exists ? millis : null
}

export function isValidLocalDate(fecha: string): boolean {
  return civilNoon(fecha) !== null
}

/** Fecha de hoy en la zona del consultorio. Solo sirve como punto de partida de la navegación. */
export function todayLocal(now: Date = new Date()): string {
  return todayFormatter.format(now)
}

/** Fecha civil del instante ISO en la zona del consultorio. */
export function localDateFromInstant(iso: string): string {
  return todayFormatter.format(new Date(iso))
}

/** Límites inclusivos del mes civil de una fecha. El rango nunca supera los 31 días de la API. */
export function monthRange(fecha: string): { desde: string; hasta: string } {
  const millis = civilNoon(fecha)
  if (millis === null) throw new RangeError('Fecha local inexistente')
  const date = new Date(millis)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const firstDay = new Date(Date.UTC(year, month, 1))
  const lastDay = new Date(Date.UTC(year, month + 1, 0))
  return {
    desde: firstDay.toISOString().slice(0, 10),
    hasta: lastDay.toISOString().slice(0, 10),
  }
}

/** Suma días a una fecha civil válida. */
export function addDaysToLocalDate(fecha: string, days: number): string {
  const millis = civilNoon(fecha)
  if (millis === null) throw new RangeError('Fecha local inexistente')
  return new Date(millis + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** "miércoles, 10 de marzo de 2027" */
export function formatCivilDate(fecha: string): string {
  const millis = civilNoon(fecha)
  return millis === null ? fecha : civilDateFormatter.format(new Date(millis))
}

/** "10:00" */
export function formatLocalTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

/** "10:00–10:40" */
export function formatLocalRange(startIso: string, endIso: string): string {
  return `${formatLocalTime(startIso)}–${formatLocalTime(endIso)}`
}

/** "11:30–12:30" para horas locales `HH:mm` que ya vienen del backend. */
export function formatHourRange(start: string, end: string): string {
  return `${start}–${end}`
}
