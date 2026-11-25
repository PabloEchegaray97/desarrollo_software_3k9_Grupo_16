import { StatePanel } from '../../../shared/components/StatePanel'
import type { Chair } from '../../catalog/types'
import { chairLabel } from './fields'
import { formatLocalDate, formatLocalTime } from './time'
import type { AppointmentEventType, LifecycleEvent } from './types'

interface HistoryTimelineProps {
  eventos: readonly LifecycleEvent[]
  chairs?: readonly Chair[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

const LABELS: Readonly<Record<AppointmentEventType, string>> = {
  CREADO: 'Creación',
  REPROGRAMADO: 'Reprogramación',
  CANCELADO: 'Cancelación',
  CAMBIO_ESTADO: 'Cambio de estado',
  EXCEPCION: 'Excepción',
}

const text = (value: string | null): string => value ?? ''

function describe(event: LifecycleEvent, chairs: readonly Chair[]): string {
  switch (event.tipo) {
    case 'CREADO':
      return `Inicio ${formatLocalTime(event.inicioNuevo ?? event.ocurridoEn)} · ${chairLabel(event.sillonNuevoId, chairs)}.`
    case 'REPROGRAMADO': {
      const parts: string[] = []
      if (event.inicioAnterior && event.inicioNuevo) {
        parts.push(`${formatLocalTime(event.inicioAnterior)} → ${formatLocalTime(event.inicioNuevo)}`)
      }
      if (event.sillonAnteriorId || event.sillonNuevoId) {
        parts.push(`${chairLabel(event.sillonAnteriorId, chairs)} → ${chairLabel(event.sillonNuevoId, chairs)}`)
      }
      if (event.estadoAnterior && event.estadoNuevo) {
        parts.push(`${event.estadoAnterior} → ${event.estadoNuevo}`)
      }
      if (event.motivo) parts.push(`Motivo: ${event.motivo}.`)
      return parts.length > 0 ? `${parts.join(' · ')}.` : 'El horario del turno se modificó.'
    }
    case 'CANCELADO':
      return event.motivo ? `Motivo: ${event.motivo}.` : 'El turno se canceló.'
    case 'CAMBIO_ESTADO':
      return `${text(event.estadoAnterior)} → ${text(event.estadoNuevo)}.`
    case 'EXCEPCION':
      return event.motivo ? `Motivo: ${event.motivo}.` : 'El turno se registró fuera de la disponibilidad.'
  }
}

/** Solo presenta la proyección P1-02: no edita eventos ni inventa datos ausentes. */
export function HistoryTimeline({ eventos, chairs = [], loading = false, error = null, onRetry }: HistoryTimelineProps) {
  if (loading) {
    return <StatePanel state="loading" title="Cargando historial…" description="Esto puede tardar unos segundos." />
  }
  if (error) {
    return <StatePanel state="error" title="No se pudo cargar el historial" description={error} actionLabel="Reintentar" onAction={onRetry} />
  }
  if (eventos.length === 0) {
    return <StatePanel state="empty" title="Todavía no hay eventos" description="Las acciones del turno aparecerán aquí en orden cronológico." />
  }

  return (
    <ol className="lc-timeline" aria-label="Historial del turno">
      {eventos.map((evento) => (
        <li className="lc-timeline__item" data-tipo={evento.tipo} aria-label={LABELS[evento.tipo]} key={evento.id}>
          <h3 className="lc-timeline__title">{LABELS[evento.tipo]}</h3>
          <p className="lc-timeline__description">{describe(evento, chairs)}</p>
          <time className="lc-timeline__time" dateTime={evento.ocurridoEn}>
            {formatLocalDate(evento.ocurridoEn)} · {formatLocalTime(evento.ocurridoEn)}
          </time>
        </li>
      ))}
    </ol>
  )
}
