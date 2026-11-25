import { ArrowRight, CalendarPlus, CheckCircle, WarningCircle, X } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Button } from '../../catalog/ui/Button'
import { formatLocalDate, formatLocalTime } from './time'
import type { Appointment } from './types'

interface AppointmentSummaryProps {
  appointment: Appointment
  patientName: string
  procedureName: string
  chairName: string
  onCreateAnother: () => void
  onClose?: () => void
}

/** Presenta el turno tal como lo guardó el backend, en la hora local del consultorio. */
export function AppointmentSummary({ appointment, patientName, procedureName, chairName, onCreateAnother, onClose }: AppointmentSummaryProps) {
  const rows: Array<[string, string]> = [
    ['Paciente', patientName],
    ['Prestación', procedureName],
    ['Sillón', chairName],
    ['Fecha', formatLocalDate(appointment.inicio)],
    ['Atención', `${formatLocalTime(appointment.inicio)} a ${formatLocalTime(appointment.finAtencion)} · ${appointment.duracionMinutos} min`],
    ['Fin del bloqueo', `${formatLocalTime(appointment.finBloqueo)} · intervalo de ${appointment.intervaloPosteriorMinutos} min`],
  ]
  if (appointment.fueraDisponibilidad && appointment.motivoExcepcion) rows.push(['Motivo de la excepción', appointment.motivoExcepcion])

  return (
    <section className="apt-summary" aria-labelledby="apt-summary-title">
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
        <span className="apt-summary__status" data-warning={appointment.fueraDisponibilidad ? 'true' : 'false'}>
          {appointment.fueraDisponibilidad ? 'Fuera de disponibilidad' : 'Programado'}
        </span>
      </header>

      <dl className="apt-summary__list">
        {rows.map(([label, value]) => (
          <div className="apt-summary__item" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="apt-summary__actions">
        <Link className="app-button app-button--ghost app-button--md apt-summary__link" to={`/turnos/${appointment.id}`}>
          <span>Ver turno</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Button variant="primary" leftIcon={<CalendarPlus size={16} />} onClick={onCreateAnother}>Crear otro turno</Button>
        {onClose ? <Button variant="secondary" leftIcon={<X size={16} />} onClick={onClose}>Cerrar</Button> : null}
      </div>
    </section>
  )
}
