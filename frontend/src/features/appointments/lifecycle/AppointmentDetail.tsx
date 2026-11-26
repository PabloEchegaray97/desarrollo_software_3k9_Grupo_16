import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  CalendarBlank,
  Clock,
  IdentificationCard,
  ListBullets,
  Phone,
  Scroll,
  Stethoscope,
  Tooth,
  User,
} from '@phosphor-icons/react'
import { AppButton } from '../../../shared/components/Button'
import type { Chair, Procedure } from '../../catalog/types'
import type { Patient } from '../../patients/types'
import { chairLabel } from './fields'
import { HistoryTimeline } from './HistoryTimeline'
import { StatusActions } from './StatusActions'
import { formatLocalRange, formatLocalShortDate, formatLocalTime } from './time'
import type { ChangeableStatus, LifecycleAppointment, LifecycleEvent } from './types'

interface AppointmentDetailProps {
  appointment: LifecycleAppointment
  eventos: readonly LifecycleEvent[]
  chairs: readonly Chair[]
  patients: readonly Patient[]
  procedures: readonly Procedure[]
  busy?: boolean
  onBack: () => void
  onReschedule: () => void
  onCancel: () => void
  onChangeStatus: (estado: ChangeableStatus) => void
}

type DetailTab = 'detail' | 'history'

export function AppointmentDetail({ appointment, eventos, chairs, patients, procedures, busy = false, onBack, onReschedule, onCancel, onChangeStatus }: AppointmentDetailProps) {
  const [tab, setTab] = useState<DetailTab>('detail')
  const patient = useMemo(() => patients.find((item) => item.id === appointment.pacienteId) ?? null, [appointment.pacienteId, patients])
  const procedure = useMemo(() => procedures.find((item) => item.id === appointment.prestacionId) ?? null, [appointment.prestacionId, procedures])
  const patientName = patient?.nombre ?? 'Paciente'

  return (
    <article className="lc-detail">
      <div className="lc-detail__back"><AppButton variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={onBack}>Volver a la agenda</AppButton></div>

      <div className="lc-tabs" role="tablist" aria-label="Secciones del turno">
        <button type="button" role="tab" aria-selected={tab === 'detail'} onClick={() => setTab('detail')}><ListBullets size={16} /> Detalle</button>
        <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}><Scroll size={16} /> Historial</button>
      </div>

      <div className="lc-detail__surface">
        <header className="lc-detail__header">
          <div>
            <h1 className="lc-detail__title" id="lc-detail-title" tabIndex={-1}>Turno de {patientName}</h1>
            <p>{formatLocalShortDate(appointment.inicio)} · {formatLocalRange(appointment.inicio, appointment.finAtencion)}</p>
          </div>
          <span className="lc-badge appointment-status-badge" data-estado={appointment.estado} data-status={appointment.estado}>{appointment.estado}</span>
        </header>

        {tab === 'detail' ? (
          <div className="lc-tab-panel lc-tab-panel--detail" role="tabpanel">
            <section className="lc-section" aria-labelledby="lc-booking-title">
              <h2 className="lc-section-title" id="lc-booking-title">Detalle de la reserva</h2>
              <dl className="lc-detail-grid">
                <DetailField icon={<Stethoscope />} label="Prestación" value={procedure?.nombre ?? 'Prestación no disponible'} />
                <DetailField icon={<Tooth />} label="Sillón" value={chairLabel(appointment.sillonId, chairs)} />
                <DetailField icon={<CalendarBlank />} label="Fecha" value={formatLocalShortDate(appointment.inicio)} />
                <DetailField icon={<Clock />} label="Horario" value={formatLocalRange(appointment.inicio, appointment.finAtencion)} />
                <DetailField icon={<Clock />} label="Duración" value={`${appointment.duracionMinutos} minutos`} />
                <DetailField icon={<Clock />} label="Fin del bloqueo" value={`${formatLocalTime(appointment.finBloqueo)} · intervalo ${appointment.intervaloPosteriorMinutos} min`} />
              </dl>
            </section>

            <section className="lc-section" aria-labelledby="lc-patient-title">
              <h2 className="lc-section-title" id="lc-patient-title">Paciente</h2>
              <div className="lc-patient-card">
                <div className="lc-patient-card__avatar" aria-hidden="true">{initials(patientName)}</div>
                <div className="lc-patient-card__identity"><strong>{patientName}</strong><span>{patient?.activo === false ? 'Paciente inactivo' : 'Paciente activo'}</span></div>
                <div className="lc-patient-card__contact">
                  <span><Phone size={15} />{patient?.telefono ?? 'Teléfono no registrado'}</span>
                  <span><IdentificationCard size={15} />{patient?.dni ?? 'DNI no registrado'}</span>
                  <span><User size={15} />{patient?.email ?? 'Email no registrado'}</span>
                </div>
              </div>
            </section>

            {appointment.fueraDisponibilidad || appointment.motivoCancelacion ? (
              <section className="lc-section" aria-labelledby="lc-notes-title">
                <h2 className="lc-section-title" id="lc-notes-title">Observaciones</h2>
                <div className="lc-detail__notes">
                  {appointment.fueraDisponibilidad ? <p><strong>Excepción:</strong> {appointment.motivoExcepcion ?? 'Sin motivo registrado'}</p> : null}
                  {appointment.motivoCancelacion ? <p><strong>Cancelación:</strong> {appointment.motivoCancelacion}</p> : null}
                </div>
              </section>
            ) : null}

            <StatusActions status={appointment.estado} startsAt={appointment.inicio} busy={busy} onReschedule={onReschedule} onCancel={onCancel} onChangeStatus={onChangeStatus} />
          </div>
        ) : (
          <section className="lc-tab-panel lc-tab-panel--history" role="tabpanel" aria-labelledby="lc-history-title">
            <div className="lc-history-heading"><h2 className="lc-section-title" id="lc-history-title">Historial del turno</h2><p>Creación, reprogramaciones, cambios de estado y cancelaciones.</p></div>
            <HistoryTimeline eventos={eventos} chairs={chairs} />
          </section>
        )}
      </div>
    </article>
  )
}

function DetailField({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div><dt><span aria-hidden="true">{icon}</span>{label}</dt><dd>{value}</dd></div>
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'P'
}
