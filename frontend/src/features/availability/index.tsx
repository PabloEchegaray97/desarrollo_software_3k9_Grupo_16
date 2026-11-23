import { ExceptionsForm } from './ui/ExceptionsForm'
import { WeeklyScheduleForm } from './ui/WeeklyScheduleForm'
import './ui/styles.css'

export function AvailabilityPage() {
  return (
    <section className="avail-page" aria-labelledby="avail-title">
      <h1 className="page-heading" id="avail-title">Disponibilidad</h1>
      <p className="page-lead">Configurá los horarios de atención y las excepciones fechadas del consultorio.</p>
      <WeeklyScheduleForm />
      <ExceptionsForm />
    </section>
  )
}
