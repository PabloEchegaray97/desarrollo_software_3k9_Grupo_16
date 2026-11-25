import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarBlank,
  CalendarPlus,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  IdentificationCard,
  ListBullets,
  PencilSimple,
  Phone,
  Stethoscope,
  Tooth,
  TrendDown,
  UserCircle,
} from '@phosphor-icons/react'
import { StatePanel } from '../../shared/components/StatePanel'
import { AppModal } from '../../shared/components/AppModal'
import { Button } from '../catalog/ui/Button'
import '../catalog/ui/admin-ui.css'
import { patientsApi } from './api'
import { PatientForm } from './PatientForm'
import type { PatientAppointmentStatus, PatientProfile } from './types'

type ProfileState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; patient: PatientProfile }

const statusLabel: Record<PatientAppointmentStatus, string> = {
  PROGRAMADO: 'Programado',
  CONFIRMADO: 'Confirmado',
  ATENDIDO: 'Atendido',
  CANCELADO: 'Cancelado',
  AUSENTE: 'Ausente',
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('es-AR')).join('')
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin turnos atendidos'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin dato'
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'America/Argentina/Buenos_Aires' }).format(date)
}

function formatAppointment(value: string): { date: string; time: string } {
  const date = new Date(value)
  return {
    date: new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(date),
    time: new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }).format(date),
  }
}

export function PatientProfilePage() {
  const { patientId = '' } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ProfileState>({ status: 'loading' })
  const [editing, setEditing] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => setAttempt((current) => current + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })
    patientsApi.detail(patientId, controller.signal)
      .then((patient) => { if (active) setState({ status: 'ready', patient }) })
      .catch(() => { if (active && !controller.signal.aborted) setState({ status: 'error', message: 'No se pudo cargar el detalle del paciente.' }) })
    return () => { active = false; controller.abort() }
  }, [patientId, attempt])

  if (state.status === 'loading') return <StatePanel state="loading" title="Cargando paciente…" description="" />
  if (state.status === 'error') return <StatePanel state="error" title="No se pudo cargar el paciente" description={state.message} actionLabel="Reintentar" onAction={load} />

  const patient = state.patient
  const toggle = async () => {
    setBusy(true)
    try {
      await patientsApi.setActive(patient.id, !patient.activo)
      load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="patient-profile">
      <div className="patient-profile__topbar">
        <button type="button" className="patient-profile__back" onClick={() => navigate('/pacientes')}><ArrowLeft size={16} />Volver a clientes</button>
        <Button className="patient-profile__mobile-actions" size="sm" variant="secondary" leftIcon={<ListBullets />} onClick={() => setActionsOpen(true)}>Acciones</Button>
      </div>

      <header className="patient-profile__hero">
        <span className="patient-profile__avatar" aria-hidden="true">{initials(patient.nombre)}</span>
        <div className="patient-profile__identity">
          <div><h1>{patient.nombre}</h1><span data-active={patient.activo}>{patient.activo ? 'Activo' : 'Inactivo'}</span></div>
          <p><Phone size={15} />{patient.telefono}<EnvelopeSimple size={15} />{patient.email ?? 'Email no registrado'}</p>
        </div>
        <Button className="detail-edit-button patient-profile__hero-edit" variant="secondary" leftIcon={<PencilSimple />} onClick={() => setEditing(true)}>Editar</Button>
      </header>

      <div className="patient-profile__layout">
        <main className="patient-profile__main">
          <section className="patient-profile__card">
            <div className="patient-profile__section-heading"><div><h2>Resumen del paciente</h2><p>Actividad y comportamiento de sus turnos.</p></div></div>
            <div className="patient-profile__metrics">
              <article><CalendarBlank size={20} /><span>Total de turnos</span><strong>{patient.resumen.totalTurnos}</strong></article>
              <article><CheckCircle size={20} /><span>Atendidos</span><strong>{patient.resumen.atendidos}</strong></article>
              <article><CalendarBlank size={20} /><span>Confirmados</span><strong>{patient.resumen.confirmados}</strong></article>
              <article><TrendDown size={20} /><span>Tasa de cancelación</span><strong>{patient.resumen.tasaCancelacion}%</strong></article>
            </div>

            <div className="patient-profile__facts">
              <div><CalendarBlank size={16} /><span>Paciente desde</span><strong>{formatDate(patient.createdAt)}</strong></div>
              <div><Clock size={16} /><span>Última atención</span><strong>{formatDate(patient.resumen.ultimaAtencion)}</strong></div>
              <div><Stethoscope size={16} /><span>Prestación más frecuente</span><strong>{patient.resumen.prestacionMasFrecuente ?? 'Sin datos'}</strong></div>
              <div><IdentificationCard size={16} /><span>DNI</span><strong>{patient.dni ?? 'No registrado'}</strong></div>
            </div>
          </section>

          <section className="patient-profile__card patient-profile__history">
            <div className="patient-profile__section-heading"><div><h2>Historial de turnos</h2><p>{patient.turnos.length} turno{patient.turnos.length === 1 ? '' : 's'} registrado{patient.turnos.length === 1 ? '' : 's'}.</p></div></div>
            {patient.turnos.length === 0 ? (
              <div className="patient-profile__empty"><CalendarBlank size={28} /><strong>Sin historial</strong><span>Este paciente todavía no tiene turnos registrados.</span></div>
            ) : (
              <div className="patient-profile__appointments">
                {patient.turnos.map((appointment) => {
                  const formatted = formatAppointment(appointment.inicio)
                  return (
                    <Link key={appointment.id} to={`/turnos/${appointment.id}`}>
                      <time><strong>{formatted.time}</strong><span>{formatted.date}</span></time>
                      <span className="patient-profile__appointment-body"><strong>{appointment.prestacion.nombre}</strong><small><Tooth size={13} />{appointment.sillon.nombre} · {appointment.duracionMinutos} min</small></span>
                      <span className="patient-profile__appointment-status appointment-status-badge" data-status={appointment.estado}>{statusLabel[appointment.estado]}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="patient-profile__actions patient-profile__card">
          <h2>Acciones</h2>
          <Link className="app-button app-button--primary app-button--md adm-button adm-button--primary" to="/turnos/nuevo" state={{ backgroundLocation: location }}><CalendarPlus size={16} />Nuevo turno</Link>
          <Button className="detail-edit-button" variant="secondary" leftIcon={<PencilSimple />} onClick={() => setEditing(true)}>Editar información</Button>
          <Button variant={patient.activo ? 'danger' : 'secondary'} leftIcon={<UserCircle />} onClick={() => void toggle()} loading={busy}>{patient.activo ? 'Desactivar paciente' : 'Reactivar paciente'}</Button>
        </aside>
      </div>

      {editing ? <PatientForm patient={patient} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} /> : null}
      <AppModal
        open={actionsOpen}
        title="Acciones del paciente"
        description={patient.nombre}
        onClose={() => { if (!busy) setActionsOpen(false) }}
        restoreFocus={false}
        className="patient-profile-actions-sheet app-modal--compact-sheet"
        closeLabel="Cerrar acciones del paciente"
      >
        <div className="patient-profile-actions-sheet__actions">
          <Link className="app-button app-button--primary app-button--md adm-button adm-button--primary" to="/turnos/nuevo" state={{ backgroundLocation: location }} onClick={() => setActionsOpen(false)}><CalendarPlus size={16} />Nuevo turno</Link>
          <Button className="detail-edit-button" variant="secondary" leftIcon={<PencilSimple />} onClick={() => { setActionsOpen(false); setEditing(true) }}>Editar información</Button>
          <Button variant={patient.activo ? 'danger' : 'secondary'} leftIcon={<UserCircle />} onClick={() => { setActionsOpen(false); void toggle() }} loading={busy}>{patient.activo ? 'Desactivar paciente' : 'Reactivar paciente'}</Button>
        </div>
      </AppModal>
    </section>
  )
}
