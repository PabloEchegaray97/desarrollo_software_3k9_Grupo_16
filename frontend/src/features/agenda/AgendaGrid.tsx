import { StatusBadge } from './StatusBadge'
import { formatLocalRange } from './time'
import type { AgendaTurno } from './types'

interface AgendaGridProps {
  turnos: readonly AgendaTurno[]
  selectedId?: string
  onSelect: (turno: AgendaTurno) => void
}

export function AgendaGrid({ turnos, selectedId, onSelect }: AgendaGridProps) {
  return (
    <ul className="agenda-grid__items" aria-label="Turnos en grilla">
      {turnos.map((turno) => {
        const selected = turno.id === selectedId
        const cancelled = turno.estado === 'CANCELADO'

        return (
          <li
            key={turno.id}
            className="agenda-grid__item"
            data-status={turno.estado}
            data-selected={selected}
          >
            <button
              type="button"
              className="agenda-grid__button"
              aria-pressed={selected}
              data-turno-id={turno.id}
              onClick={() => onSelect(turno)}
            >
              <time className="agenda-grid__time" dateTime={turno.inicio}>
                {cancelled ? <s>{formatLocalRange(turno.inicio, turno.finAtencion)}</s> : formatLocalRange(turno.inicio, turno.finAtencion)}
              </time>
              <span className="agenda-grid__patient">{turno.paciente.nombre}</span>
              <span className="agenda-grid__details">{turno.prestacion.nombre} · {turno.sillon.nombre}</span>
              <span className="agenda-grid__status"><StatusBadge estado={turno.estado} /></span>
              {turno.intervaloPosteriorMinutos > 0 ? (
                <span className="agenda-grid__interval">
                  Intervalo {formatLocalRange(turno.finAtencion, turno.finBloqueo)}
                </span>
              ) : null}
              {turno.fueraDisponibilidad ? (
                <span className="agenda-row__tag">Fuera de disponibilidad</span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
