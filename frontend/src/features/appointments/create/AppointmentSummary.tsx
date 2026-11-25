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
    ['Atención', `${formatLocalTime(appointment.inicio)} a ${formatLocalTime(appointment.finAtencion)} (${appointment.duracionMinutos} min)`],
    ['Fin del bloqueo', `${formatLocalTime(appointment.finBloqueo)} (intervalo de ${appointment.intervaloPosteriorMinutos} min)`],
  ]
  if (appointment.fueraDisponibilidad && appointment.motivoExcepcion) rows.push(['Motivo de la excepción', appointment.motivoExcepcion])

  return (
    <section className="apt-summary" aria-labelledby="apt-summary-title">
      <h2 className="apt-summary__title" id="apt-summary-title" tabIndex={-1}>
        Turno registrado
        {appointment.fueraDisponibilidad
          ? <span className="apt-badge">Fuera de disponibilidad</span>
          : <span className="apt-badge apt-badge--ok">Programado</span>}
      </h2>
      <dl className="apt-summary__list">
        {rows.map(([label, value]) => (
          <div className="apt-summary__row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="apt-actions">
        <Link className="adm-button adm-button--ghost" to={`/turnos/${appointment.id}`}>Ver turno</Link>
        <Button variant="primary" onClick={onCreateAnother}>Crear otro turno</Button>
        {onClose ? <Button variant="secondary" onClick={onClose}>Cerrar</Button> : null}
      </div>
    </section>
  )
}
