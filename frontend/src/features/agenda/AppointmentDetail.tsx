import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowsClockwise, Clock, Eye, HourglassMedium, LockKey, Stethoscope, Tooth, WarningCircle, X, XCircle } from '@phosphor-icons/react'
import type { AgendaActionsRenderer } from './contracts'
import { StatusBadge } from './StatusBadge'
import { formatLocalRange } from './time'
import type { AgendaTurno } from './types'

interface Props {
  turno: AgendaTurno
  onClose: () => void
  onChanged: () => void
  renderActions?: AgendaActionsRenderer
  displayMode?: 'panel' | 'modal'
}

function DetailField({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="agenda-detail__field">
      <dt><span aria-hidden="true">{icon}</span>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Detalle construido solo con los datos de la lista: sin contacto ni información clínica. */
export function AppointmentDetail({ turno, onClose, onChanged, renderActions, displayMode = 'panel' }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const terminal = turno.estado === 'CANCELADO' || turno.estado === 'ATENDIDO' || turno.estado === 'AUSENTE'
  useEffect(() => {
    if (displayMode === 'panel') headingRef.current?.focus()
  }, [displayMode, turno.id])
  useEffect(() => {
    if (displayMode !== 'panel') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [displayMode, onClose])
  return (
    <aside className={`agenda-detail${displayMode === 'modal' ? ' agenda-detail--modal' : ''}`} aria-label="Detalle del turno">
      {displayMode === 'panel' ? (
        <div className="agenda-detail__head">
          <h3 ref={headingRef} tabIndex={-1}>{turno.paciente.nombre}</h3>
          <button type="button" className="agenda-detail__close" aria-label="Cerrar detalle" title="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <StatusBadge estado={turno.estado} />
      <dl className="agenda-detail__list">
        <DetailField icon={<Clock />} label="Atención">{formatLocalRange(turno.inicio, turno.finAtencion)} ({turno.duracionMinutos} min)</DetailField>
        {turno.intervaloPosteriorMinutos > 0 ? <DetailField icon={<HourglassMedium />} label="Intervalo posterior">{formatLocalRange(turno.finAtencion, turno.finBloqueo)} ({turno.intervaloPosteriorMinutos} min)</DetailField> : null}
        <DetailField icon={<Stethoscope />} label="Prestación">{turno.prestacion.nombre}</DetailField>
        <DetailField icon={<Tooth />} label="Sillón">{turno.sillon.nombre}</DetailField>
        <DetailField icon={<LockKey />} label="Bloquea el horario">{turno.bloqueaHorario ? 'Sí' : 'No'}</DetailField>
        {turno.fueraDisponibilidad ? <DetailField icon={<WarningCircle />} label="Fuera de disponibilidad">{turno.motivoExcepcion ?? 'Sin motivo registrado'}</DetailField> : null}
      </dl>
      <footer className="agenda-detail__footer">
        {renderActions ? <div className="agenda-detail__actions">{renderActions({ turno, onChanged })}</div> : null}
        {terminal ? (
          <button type="button" className="agenda-action-button agenda-action-button--danger" disabled><XCircle size={17} aria-hidden="true" /> Cancelar</button>
        ) : (
          <Link className="agenda-action-button agenda-action-button--danger" to={`/turnos/${turno.id}`} state={{ dashboardAction: 'cancel' }}>
            <XCircle size={17} aria-hidden="true" /> Cancelar
          </Link>
        )}
        {terminal ? (
          <button type="button" className="agenda-action-button agenda-action-button--primary-outline" disabled><ArrowsClockwise size={17} aria-hidden="true" /> Reprogramar</button>
        ) : (
          <Link className="agenda-action-button agenda-action-button--primary-outline" to={`/turnos/${turno.id}`} state={{ dashboardAction: 'reschedule' }}>
            <ArrowsClockwise size={17} aria-hidden="true" /> Reprogramar
          </Link>
        )}
        <Link className="agenda-action-button agenda-action-button--primary agenda-detail__link" to={`/turnos/${turno.id}`}>
          <Eye size={17} aria-hidden="true" /> Ver detalle
        </Link>
      </footer>
    </aside>
  )
}
