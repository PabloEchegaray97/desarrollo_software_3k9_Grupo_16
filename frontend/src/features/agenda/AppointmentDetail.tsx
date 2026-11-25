import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, X } from '@phosphor-icons/react'
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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  return (
    <aside className="agenda-detail" aria-label="Detalle del turno">
      <div className="agenda-detail__head">
        <h3 ref={headingRef} tabIndex={-1}>{turno.paciente.nombre}</h3>
        <button type="button" className="agenda-action-button agenda-detail__close" onClick={onClose}>
          <X size={16} aria-hidden="true" />
          Cerrar detalle
        </button>
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
      <Link className="agenda-detail__link" to={`/turnos/${turno.id}`}>
        Gestionar turno <ArrowRight size={16} aria-hidden="true" />
      </Link>
      {renderActions ? <div className="agenda-detail__actions">{renderActions({ turno, onChanged })}</div> : null}
    </aside>
  )
}
