/** Zona operativa del consultorio (RN-TI-01). La interfaz solo presenta instantes que decide el backend. */
export const CLINIC_TIME_ZONE = 'America/Argentina/Buenos_Aires'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: CLINIC_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "miércoles, 10 de marzo de 2027" */
export function formatLocalDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** "10:00" */
export function formatLocalTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

/** "10:00–10:40" */
export function formatLocalRange(startIso: string, endIso: string): string {
  return `${formatLocalTime(startIso)}–${formatLocalTime(endIso)}`
}
