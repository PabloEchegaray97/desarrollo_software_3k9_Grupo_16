import type { AppointmentStatus } from './types'

/** Formas distintas por estado: el estado nunca depende solo del color. */
export type StatusShape = 'circle-outline' | 'circle-check' | 'square-check' | 'triangle-alert' | 'cross'

export interface StatusPresentation {
  label: string
  shape: StatusShape
}

export const STATUS_PRESENTATION: Record<AppointmentStatus, StatusPresentation> = {
  PROGRAMADO: { label: 'Programado', shape: 'circle-outline' },
  CONFIRMADO: { label: 'Confirmado', shape: 'circle-check' },
  ATENDIDO: { label: 'Atendido', shape: 'square-check' },
  AUSENTE: { label: 'Ausente', shape: 'triangle-alert' },
  CANCELADO: { label: 'Cancelado', shape: 'cross' },
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  FERIADO: 'Feriado',
  VACACIONES: 'Vacaciones',
  BLOQUEO: 'Bloqueo',
}

/** Etiqueta de un bloqueo de disponibilidad; un tipo desconocido se muestra tal como llega. */
export function blockTypeLabel(tipo: string): string {
  return BLOCK_TYPE_LABELS[tipo] ?? tipo
}
