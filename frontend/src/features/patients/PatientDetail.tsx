import { ArrowCounterClockwise, EnvelopeSimple, IdentificationCard, ListBullets, PencilSimple, Phone, Trash } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Button } from '../catalog/ui/Button'
import type { Patient } from './types'

interface PatientDetailProps {
  patient: Patient | null
  onEdit?: () => void
  onToggle?: () => void
  actionsMode?: 'inline' | 'sheet-trigger'
  onOpenActions?: () => void
  busy?: boolean
}

export function PatientDetail({
  patient,
  onEdit,
  onToggle,
  actionsMode = 'inline',
  onOpenActions,
  busy = false,
}: PatientDetailProps) {
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
        <div className="detail-header-actions">
          {actionsMode === 'sheet-trigger' ? (
            <Button size="sm" variant="secondary" leftIcon={<ListBullets />} onClick={onOpenActions}>Acciones</Button>
          ) : (
            <>
              {onToggle ? patient.activo ? (
                <Button size="sm" variant="danger" leftIcon={<Trash />} loading={busy} aria-label={`Eliminar ${patient.nombre}`} onClick={onToggle}>Eliminar cliente</Button>
              ) : (
                <Button size="sm" variant="secondary" leftIcon={<ArrowCounterClockwise />} loading={busy} aria-label={`Reactivar ${patient.nombre}`} onClick={onToggle}>Reactivar</Button>
              ) : null}
              {onEdit ? <Button className="detail-edit-button" size="sm" variant="secondary" leftIcon={<PencilSimple />} aria-label={`Editar ${patient.nombre}`} onClick={onEdit}>Editar</Button> : null}
            </>
          )}
        </div>
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

      {actionsMode === 'inline' ? (
        <footer className="clients-detail__actions">
          <Link className="app-button app-button--primary app-button--sm adm-button adm-button--primary" to={`/pacientes/${patient.id}`}>
            <IdentificationCard size={16} aria-hidden="true" />
            Ver perfil
          </Link>
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
