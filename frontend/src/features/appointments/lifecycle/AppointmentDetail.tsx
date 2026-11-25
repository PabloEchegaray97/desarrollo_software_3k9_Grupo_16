import type { Chair } from '../../catalog/types'
import { chairLabel } from './fields'
import { HistoryTimeline } from './HistoryTimeline'
import { StatusActions } from './StatusActions'
import { formatLocalRange, formatLocalShortDate, formatLocalTime } from './time'
import type { ChangeableStatus, LifecycleAppointment, LifecycleEvent } from './types'

interface AppointmentDetailProps {
  appointment: LifecycleAppointment
  eventos: readonly LifecycleEvent[]
  chairs: readonly Chair[]
  busy?: boolean
  onReschedule: () => void
  onCancel: () => void
  onChangeStatus: (estado: ChangeableStatus) => void
}

export function AppointmentDetail({
  appointment,
  eventos,
  chairs,
  busy = false,
  onReschedule,
  onCancel,
  onChangeStatus,
}: AppointmentDetailProps) {
  return (
    <article className="lc-detail">
      <header className="lc-detail__header">
        <div>
          <h1 className="page-heading lc-detail__title" id="lc-detail-title" tabIndex={-1}>Detalle del turno</h1>
          <p className="page-lead">Horarios en la zona del consultorio. Los cambios se validan en el servidor.</p>
        </div>
        <span className="lc-badge" data-estado={appointment.estado}>{appointment.estado}</span>
      </header>

      <dl className="lc-detail__list">
        <div className="lc-detail__row">
          <dt>Fecha</dt>
          <dd>{formatLocalShortDate(appointment.inicio)}</dd>
        </div>
        <div className="lc-detail__row">
          <dt>Horario de atención</dt>
          <dd>{formatLocalRange(appointment.inicio, appointment.finAtencion)}</dd>
        </div>
        <div className="lc-detail__row">
          <dt>Fin de bloqueo</dt>
          <dd>{formatLocalTime(appointment.finBloqueo)}</dd>
        </div>
        <div className="lc-detail__row">
          <dt>Sillón</dt>
          <dd>{chairLabel(appointment.sillonId, chairs)}</dd>
        </div>
        <div className="lc-detail__row">
          <dt>Minutos efectivos</dt>
          <dd>{appointment.duracionMinutos} de atención · {appointment.intervaloPosteriorMinutos} posteriores</dd>
        </div>
        {appointment.fueraDisponibilidad && appointment.motivoExcepcion ? (
          <div className="lc-detail__row">
            <dt>Excepción</dt>
            <dd>{appointment.motivoExcepcion}</dd>
          </div>
        ) : null}
        {appointment.motivoCancelacion ? (
          <div className="lc-detail__row">
            <dt>Motivo de cancelación</dt>
            <dd>{appointment.motivoCancelacion}</dd>
          </div>
        ) : null}
      </dl>

      <StatusActions
        status={appointment.estado}
        busy={busy}
        onReschedule={onReschedule}
        onCancel={onCancel}
        onChangeStatus={onChangeStatus}
      />

      <section className="lc-section" aria-labelledby="lc-history-title">
        <h2 className="lc-section-title" id="lc-history-title">Historial del turno</h2>
        <HistoryTimeline eventos={eventos} chairs={chairs} />
      </section>
    </article>
  )
}
