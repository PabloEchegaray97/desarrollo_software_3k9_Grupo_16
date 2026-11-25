import { StatusBadge } from './StatusBadge'
import { formatLocalTime } from './time'
import type { AgendaTurno } from './types'

interface Props {
  turno: AgendaTurno
  selected: boolean
  onSelect: (turno: AgendaTurno) => void
}

export function AppointmentRow({ turno, selected, onSelect }: Props) {
  const timeRange = `${formatLocalTime(turno.inicio)} - ${formatLocalTime(turno.finAtencion)}`
  const cancelled = turno.estado === 'CANCELADO'
  return (
    <li className="agenda-row" data-status={turno.estado} data-selected={selected}>
      <button
        type="button"
        className="agenda-row__button"
        aria-pressed={selected}
        data-turno-id={turno.id}
        onClick={() => onSelect(turno)}
      >
        <span className="agenda-row__rail">
          <strong>{cancelled ? <s>{timeRange}</s> : timeRange}</strong>
          <small>Hs</small>
        </span>
        <span className="agenda-row__main">
          <strong>{turno.paciente.nombre}</strong>
          <span>{turno.prestacion.nombre}</span>
          <span className="agenda-row__meta">
            <span>{turno.sillon.nombre}</span>
            <span>{turno.duracionMinutos} min</span>
            {turno.fueraDisponibilidad ? (
              <span className="agenda-row__tag">Fuera de disponibilidad</span>
            ) : null}
          </span>
        </span>
        <span className="agenda-row__marks">
          <StatusBadge estado={turno.estado} />
        </span>
      </button>
    </li>
  )
}
