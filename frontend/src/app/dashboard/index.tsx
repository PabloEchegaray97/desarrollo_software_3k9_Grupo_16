import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  CalendarBlank,
  Clock,
  Stethoscope,
  Users,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { agendaApi } from '../../features/agenda/api'
import { formatCivilDate, todayLocal } from '../../features/agenda/time'
import type { AppointmentStatus, AgendaTurno } from '../../features/agenda/types'
import { StatePanel } from '../../shared/components/StatePanel'
import './dashboard.css'

const appointmentStatuses: { status: AppointmentStatus; label: string }[] = [
  { status: 'PROGRAMADO', label: 'Programados' },
  { status: 'CONFIRMADO', label: 'Confirmados' },
  { status: 'ATENDIDO', label: 'Atendidos' },
  { status: 'AUSENTE', label: 'Ausentes' },
  { status: 'CANCELADO', label: 'Cancelados' },
]

const quickLinks: { to: string; label: string; Icon: PhosphorIcon }[] = [
  { to: '/agenda', label: 'Agenda', Icon: CalendarBlank },
  { to: '/pacientes', label: 'Pacientes', Icon: Users },
  { to: '/prestaciones', label: 'Prestaciones y sillones', Icon: Stethoscope },
  { to: '/disponibilidad', label: 'Disponibilidad', Icon: Clock },
]

type DashboardLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; turnos: AgendaTurno[] }

function countStatuses(turnos: AgendaTurno[]): Record<AppointmentStatus, number> {
  const counts: Record<AppointmentStatus, number> = {
    PROGRAMADO: 0,
    CONFIRMADO: 0,
    ATENDIDO: 0,
    AUSENTE: 0,
    CANCELADO: 0,
  }

  turnos.forEach(({ estado }) => {
    counts[estado] += 1
  })

  return counts
}

export function PracticeDashboard() {
  const location = useLocation()
  const today = useMemo(() => todayLocal(), [])
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<DashboardLoad>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setLoad({ status: 'loading' })

    agendaApi
      .get({ desde: today, hasta: today }, controller.signal)
      .then(({ turnos }) => {
        if (!controller.signal.aborted) setLoad({ status: 'ready', turnos })
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: 'error' })
      })

    return () => controller.abort()
  }, [attempt, today])

  const counts = load.status === 'ready' ? countStatuses(load.turnos) : null

  return (
    <section className="practice-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-header__date">{formatCivilDate(today)}</p>
          <h1 className="page-heading">Inicio</h1>
        </div>
        <Link
          className="dashboard-primary-action"
          to="/turnos/nuevo"
          state={{ backgroundLocation: location }}
        >
          + Nuevo turno
        </Link>
      </header>

      <section className="dashboard-metrics" aria-label="Métricas de hoy">
        {load.status === 'loading' ? (
          <StatePanel state="loading" title="Cargando resumen" description="Consultando los turnos de hoy." />
        ) : null}
        {load.status === 'error' ? (
          <StatePanel
            state="error"
            title="No se pudo cargar el resumen de hoy"
            description="Intentá nuevamente en unos segundos."
            actionLabel="Reintentar"
            onAction={() => setAttempt((value) => value + 1)}
          />
        ) : null}
        {load.status === 'ready' ? (
          <>
            <article className="dashboard-metric" aria-label={`Turnos de hoy: ${load.turnos.length}`}>
              <strong className="dashboard-metric__value">{load.turnos.length}</strong>
              <h2 className="dashboard-metric__label">Turnos de hoy</h2>
            </article>
            {appointmentStatuses.map(({ status, label }) => (
              <article
                key={status}
                className="dashboard-metric"
                data-status={status}
                aria-label={`${label}: ${counts?.[status] ?? 0}`}
              >
                <strong className="dashboard-metric__value">{counts?.[status] ?? 0}</strong>
                <h2 className="dashboard-metric__label">{label}</h2>
              </article>
            ))}
            {load.turnos.length === 0 ? (
              <p className="dashboard-empty" role="status">No hay turnos para hoy.</p>
            ) : null}
          </>
        ) : null}
      </section>

      <nav className="dashboard-shortcuts" aria-label="Accesos principales">
        {quickLinks.map(({ to, label, Icon }) => (
          <Link className="dashboard-shortcut" key={to} to={to}>
            <Icon size={22} weight="regular" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </section>
  )
}
