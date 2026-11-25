import { EnvelopeSimple, PencilSimple, Phone } from '@phosphor-icons/react'
import { Button } from '../catalog/ui/Button'
import type { Patient } from './types'

interface PatientDetailProps {
  patient: Patient | null
  onEdit?: () => void
  onToggle?: () => void
  busy?: boolean
}

export function PatientDetail({ patient, onEdit, onToggle, busy = false }: PatientDetailProps) {
  if (!patient) {
    return <div className="patient-detail clients-panel patient-detail--empty"><h2>Seleccioná un paciente</h2></div>
  }

  const initials = patient.nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toLocaleUpperCase('es-AR')).join('')

  return (
    <article className="patient-detail clients-panel clients-panel--detail">
      <header className="patient-detail__header">
        <span className="patient-detail__initials" aria-hidden="true">{initials}</span>
        <div className="patient-detail__identity">
          <h2>{patient.nombre}</h2>
          <span className={`patient-detail__status${patient.activo ? '' : ' patient-detail__status--inactive'}`}>{patient.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
        {onEdit ? <Button size="sm" variant="primary" leftIcon={<PencilSimple />} onClick={onEdit}>Editar</Button> : null}
      </header>

      <section className="patient-detail__contact">
        <div><span><EnvelopeSimple size={14} /> Email</span><strong>{patient.email || 'Sin email'}</strong></div>
        <div><span><Phone size={14} /> Teléfono</span><strong>{patient.telefono}</strong></div>
      </section>

      <dl className="patient-detail__metrics">
        <div><dt>DNI</dt><dd>{patient.dni || 'No registrado'}</dd></div>
        <div><dt>Estado</dt><dd>{patient.activo ? 'Activo' : 'Inactivo'}</dd></div>
        <div><dt>Registrado</dt><dd>{formatDate(patient.createdAt)}</dd></div>
        <div><dt>Última actualización</dt><dd>{formatDate(patient.updatedAt)}</dd></div>
      </dl>

      {onToggle ? (
        <footer className="clients-detail__actions">
          <Button size="sm" variant="secondary" onClick={onToggle} loading={busy}>{patient.activo ? 'Desactivar' : 'Reactivar'}</Button>
        </footer>
      ) : null}
    </article>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'America/Argentina/Buenos_Aires' }).format(date)
}
