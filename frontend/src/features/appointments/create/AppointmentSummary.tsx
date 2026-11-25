import {
  Armchair,
  CalendarBlank,
  CheckCircle,
  Clock,
  HourglassMedium,
  Stethoscope,
  User,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Button } from '../../catalog/ui/Button'
import { formatLocalDate, formatLocalTime } from './time'
import type { Appointment } from './types'

interface AppointmentSummaryProps {
  appointment: Appointment
  patientName: string
  procedureName: string
  chairName: string
  onClose: () => void
}

interface SummaryRow {
  label: string
  value: string
  icon: ReactNode
}

/** Presenta el turno tal como lo guardó el backend, en la hora local del consultorio. */
export function AppointmentSummary({ appointment, patientName, procedureName, chairName, onClose }: AppointmentSummaryProps) {
  const rows: SummaryRow[] = [
    { label: 'Paciente', value: patientName, icon: <User size={14} aria-hidden="true" /> },
    { label: 'Prestación', value: procedureName, icon: <Stethoscope size={14} aria-hidden="true" /> },
    { label: 'Sillón', value: chairName, icon: <Armchair size={14} aria-hidden="true" /> },
    { label: 'Fecha', value: formatLocalDate(appointment.inicio), icon: <CalendarBlank size={14} aria-hidden="true" /> },
    {
      label: 'Atención',
      value: `${formatLocalTime(appointment.inicio)} a ${formatLocalTime(appointment.finAtencion)} · ${appointment.duracionMinutos} min`,
      icon: <Clock size={14} aria-hidden="true" />,
    },
    {
      label: 'Fin del bloqueo',
      value: `${formatLocalTime(appointment.finBloqueo)} · intervalo de ${appointment.intervaloPosteriorMinutos} min`,
      icon: <HourglassMedium size={14} aria-hidden="true" />,
    },
  ]
  if (appointment.fueraDisponibilidad && appointment.motivoExcepcion) {
    rows.push({
      label: 'Motivo de la excepción',
      value: appointment.motivoExcepcion,
      icon: <WarningCircle size={14} aria-hidden="true" />,
    })
  }

  return (
    <section className="apt-summary" aria-labelledby="apt-summary-title">
      <div className="apt-summary__content">
      <header className="apt-summary__hero">
        <span className="apt-summary__hero-icon" data-warning={appointment.fueraDisponibilidad ? 'true' : 'false'}>
          {appointment.fueraDisponibilidad
            ? <WarningCircle size={24} weight="fill" aria-hidden="true" />
            : <CheckCircle size={24} weight="fill" aria-hidden="true" />}
        </span>
        <div>
          <h2 id="apt-summary-title" tabIndex={-1}>Turno registrado</h2>
          <p>La reserva se guardó correctamente.</p>
        </div>
        <span
          className={`apt-summary__status${appointment.fueraDisponibilidad ? '' : ' appointment-status-badge'}`}
          data-warning={appointment.fueraDisponibilidad ? 'true' : 'false'}
          data-status={appointment.fueraDisponibilidad ? undefined : 'PROGRAMADO'}
        >
          {appointment.fueraDisponibilidad ? 'Fuera de disponibilidad' : 'Programado'}
        </span>
      </header>

      <dl className="apt-summary__list">
        {rows.map(({ label, value, icon }) => (
          <div className="apt-summary__item" key={label}>
            <dt>{icon}<span>{label}</span></dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      </div>

      <div className="apt-summary__actions apt-summary__actions--close-only">
        <Button variant="primary" leftIcon={<X size={16} />} onClick={onClose}>Cerrar</Button>
      </div>
    </section>
  )
}
