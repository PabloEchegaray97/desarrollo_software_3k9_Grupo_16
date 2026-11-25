import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { AgendaActionsRenderer } from './contracts'
import { StatusBadge } from './StatusBadge'
import { formatLocalRange } from './time'
import type { AgendaTurno } from './types'

interface Props {
  turno: AgendaTurno
  onClose: () => void
  onChanged: () => void
  renderActions?: AgendaActionsRenderer
}

/** Detalle construido solo con los datos de la lista: sin contacto ni información clínica. */
export function AppointmentDetail({ turno, onClose, onChanged, renderActions }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [turno.id])
  return (
    <aside className="agenda-detail" aria-label="Detalle del turno" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
      <div className="agenda-detail__head">
        <h3 ref={headingRef} tabIndex={-1}>{turno.paciente.nombre}</h3>
        <button type="button" onClick={onClose}>Cerrar detalle</button>
      </div>
      <StatusBadge estado={turno.estado} />
      <dl className="agenda-detail__list">
        <dt>Atención</dt><dd>{formatLocalRange(turno.inicio, turno.finAtencion)} ({turno.duracionMinutos} min)</dd>
        {turno.intervaloPosteriorMinutos > 0 ? (<><dt>Intervalo posterior</dt><dd>{formatLocalRange(turno.finAtencion, turno.finBloqueo)} ({turno.intervaloPosteriorMinutos} min)</dd></>) : null}
        <dt>Prestación</dt><dd>{turno.prestacion.nombre}</dd>
        <dt>Sillón</dt><dd>{turno.sillon.nombre}</dd>
        <dt>Bloquea el horario</dt><dd>{turno.bloqueaHorario ? 'Sí' : 'No'}</dd>
        {turno.fueraDisponibilidad ? (<><dt>Fuera de disponibilidad</dt><dd>{turno.motivoExcepcion ?? 'Sin motivo registrado'}</dd></>) : null}
      </dl>
      <Link className="agenda-detail__link" to={`/turnos/${turno.id}`}>Gestionar turno</Link>
      {renderActions ? <div className="agenda-detail__actions">{renderActions({ turno, onChanged })}</div> : null}
    </aside>
  )
}
