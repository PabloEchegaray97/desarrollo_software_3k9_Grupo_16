/** Zona operativa del consultorio. La interfaz solo presenta instantes decididos por el backend. */
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

const shortDateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: CLINIC_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function part(parts: readonly Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? ''
}

/** "miércoles, 10 de marzo de 2027" en hora del consultorio. */
export function formatLocalDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** "10/03/2027" en hora del consultorio: fecha compacta para la cabecera del detalle. */
export function formatLocalShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso))
}

/** "10:00" en hora del consultorio, sin importar la zona del navegador. */
export function formatLocalTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

/** "10:00–10:40" en hora del consultorio. */
export function formatLocalRange(startIso: string, endIso: string): string {
  return `${formatLocalTime(startIso)}–${formatLocalTime(endIso)}`
}

/** Coordenadas locales `YYYY-MM-DD`/`HH:mm` para inicializar el formulario de reprogramación. */
export function toLocalDateTimeInput(iso: string): { fecha: string; horaInicio: string } {
  const parts = partsFormatter.formatToParts(new Date(iso))
  return {
    fecha: `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`,
    horaInicio: `${part(parts, 'hour')}:${part(parts, 'minute')}`,
  }
}
