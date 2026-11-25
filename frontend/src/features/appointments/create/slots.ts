import type { AgendaDia, AgendaTurno } from '../../agenda/types'
import { CLINIC_TIME_ZONE, formatLocalTime } from './time'

const localDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function toLocalDateKey(iso: string): string {
  return localDateFormatter.format(new Date(iso))
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return hours * 60 + minutes
}

function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Devuelve la fecha actual `YYYY-MM-DD` en la zona del consultorio. */
export function currentClinicDateKey(now = new Date()): string {
  return toLocalDateKey(now.toISOString())
}

/** Devuelve los minutos transcurridos del día actual en la zona del consultorio. */
export function currentClinicMinutes(now = new Date()): number {
  return toMinutes(formatLocalTime(now.toISOString()))
}

/** Devuelve el mes actual `YYYY-MM` en la zona del consultorio. */
export function currentClinicMonthKey(now = new Date()): string {
  return currentClinicDateKey(now).slice(0, 7)
}

/** Primer y último día `YYYY-MM-DD` de un mes `YYYY-MM` (máximo 31 días para `GET /agenda`). */
export function monthBounds(monthKey: string): { desde: string; hasta: string } {
  const [year, month] = monthKey.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return {
    desde: `${monthKey}-01`,
    hasta: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
  }
}

/** `true` si el día es hoy o futuro, tiene al menos un tramo horario declarado y no tiene bloqueo de día completo. */
export function isDayDeclaredAndOpen(dia: AgendaDia | undefined, now = new Date()): boolean {
  if (!dia || dia.tramos.length === 0) return false
  if (dia.fecha < currentClinicDateKey(now)) return false
  return !dia.bloqueos.some((block) => block.horaInicio === null && block.horaFin === null)
}

interface SlotInterval {
  start: number
  end: number
}

function overlaps(aStart: number, aEnd: number, b: SlotInterval): boolean {
  return aStart < b.end && aEnd > b.start
}

/**
 * Calcula los horarios de inicio disponibles (`HH:mm`) dentro de los tramos declarados del día,
 * descontando bloqueos parciales y turnos que bloquean horario.
 */
export function computeAvailableSlots({
  dia,
  turnos,
  durationMinutes,
  postIntervalMinutes,
  stepMinutes = 15,
  now = new Date(),
}: {
  dia: AgendaDia | undefined
  turnos: readonly AgendaTurno[]
  durationMinutes: number
  postIntervalMinutes: number
  stepMinutes?: number
  now?: Date
}): string[] {
  if (!isDayDeclaredAndOpen(dia, now) || !dia) return []

  const todayKey = currentClinicDateKey(now)
  const nowMinutes = currentClinicMinutes(now)
  const isToday = dia.fecha === todayKey

  const safeDuration = Math.max(1, durationMinutes)
  const safeInterval = Math.max(0, postIntervalMinutes)
  const totalBlock = safeDuration + safeInterval

  const partialBlocks: SlotInterval[] = dia.bloqueos
    .filter((block): block is typeof block & { horaInicio: string; horaFin: string } =>
      block.horaInicio !== null && block.horaFin !== null,
    )
    .map((block) => ({
      start: toMinutes(block.horaInicio),
      end: toMinutes(block.horaFin),
    }))

  const busyTurnos: SlotInterval[] = []
  for (const turno of turnos) {
    if (!turno.bloqueaHorario) continue
    const startDate = toLocalDateKey(turno.inicio)
    const endDate = toLocalDateKey(turno.finBloqueo)
    if (endDate < dia.fecha || startDate > dia.fecha) continue
    const start = startDate < dia.fecha ? 0 : toMinutes(formatLocalTime(turno.inicio))
    const end = endDate > dia.fecha ? 24 * 60 : toMinutes(formatLocalTime(turno.finBloqueo))
    if (end > start) busyTurnos.push({ start, end })
  }

  const slots = new Set<number>()
  for (const tramo of dia.tramos) {
    const tramoStart = toMinutes(tramo.horaInicio)
    const tramoEnd = toMinutes(tramo.horaFin)
    for (let t = tramoStart; t + safeDuration <= tramoEnd; t += stepMinutes) {
      if (isToday && t <= nowMinutes) continue
      const careEnd = t + safeDuration
      const blockEnd = t + totalBlock
      if (partialBlocks.some((block) => overlaps(t, careEnd, block))) continue
      if (busyTurnos.some((busy) => overlaps(t, blockEnd, busy))) continue
      slots.add(t)
    }
  }

  return [...slots].sort((a, b) => a - b).map(fromMinutes)
}
