import { StatusBadge } from './StatusBadge'
import { formatLocalRange } from './time'
import type { AgendaTurno } from './types'

interface Props {
  turno: AgendaTurno
  selected: boolean
  onSelect: (turno: AgendaTurno) => void
}

export function AppointmentRow({ turno, selected, onSelect }: Props) {
  const atencion = formatLocalRange(turno.inicio, turno.finAtencion)
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
        <span className="agenda-row__time">{cancelled ? <s>{atencion}</s> : atencion}</span>
        <span className="agenda-row__main">
          <strong>{turno.paciente.nombre}</strong>
          <span>{turno.prestacion.nombre} · {turno.sillon.nombre}</span>
        </span>
        <span className="agenda-row__marks">
          <StatusBadge estado={turno.estado} />
          {turno.intervaloPosteriorMinutos > 0 ? (
            <span className="agenda-row__interval">Intervalo {formatLocalRange(turno.finAtencion, turno.finBloqueo)}</span>
          ) : null}
          {turno.fueraDisponibilidad ? (
            <span className="agenda-row__tag">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 12.5V1.5M3 2h8l-2 3 2 3H3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
              Fuera de disponibilidad
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}
