import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowClockwise,
  ArrowsClockwise,
  CalendarBlank,
  CalendarCheck,
  CaretDown,
  Clock,
  DotsThreeVertical,
  Eye,
  Plus,
  SealCheck,
  XCircle,
} from '@phosphor-icons/react'
import { agendaApi } from '../../features/agenda/api'
import { formatCivilDate, formatLocalTime, todayLocal } from '../../features/agenda/time'
import type { AppointmentStatus, AgendaTurno } from '../../features/agenda/types'
import { StatePanel } from '../../shared/components/StatePanel'
import './dashboard.css'

const PAGE_SIZE = 10

const statusLabels: Record<AppointmentStatus, string> = {
  PROGRAMADO: 'Programado',
  CONFIRMADO: 'Confirmado',
  ATENDIDO: 'Atendido',
  AUSENTE: 'Ausente',
  CANCELADO: 'Cancelado',
}

type DashboardLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; turnos: AgendaTurno[] }

function formatDashboardDate(date: string): string {
  return formatCivilDate(date).replace(/^\p{Ll}/u, (letter) => letter.toUpperCase())
}

function formatCountdown(iso: string, now: number): string {
  const differenceMinutes = Math.max(0, Math.round((Date.parse(iso) - now) / 60_000))
  if (differenceMinutes < 60) return `En ${differenceMinutes} min`

  const hours = Math.floor(differenceMinutes / 60)
  const minutes = differenceMinutes % 60
  return minutes === 0 ? `En ${hours}h` : `En ${hours}h ${minutes}m`
}

function isOperative(turno: AgendaTurno): boolean {
  return turno.estado === 'PROGRAMADO' || turno.estado === 'CONFIRMADO'
}

type DashboardAppointmentAction = 'detail' | 'reschedule' | 'cancel'

interface MenuPosition {
  left: number
  top: number
}

function AppointmentRow({ turno, highlighted }: { turno: AgendaTurno; highlighted: boolean }) {
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const terminal = turno.estado === 'CANCELADO' || turno.estado === 'ATENDIDO' || turno.estado === 'AUSENTE'

  useEffect(() => {
    if (!menuPosition) return

    function closeOnPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuPosition(null)
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setMenuPosition(null)
    }

    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuPosition])

  function openMenu(clientX: number, clientY: number) {
    const menuWidth = 224
    const menuHeight = 164
    setMenuPosition({
      left: Math.max(12, Math.min(clientX, window.innerWidth - menuWidth - 12)),
      top: Math.max(12, Math.min(clientY, window.innerHeight - menuHeight - 12)),
    })
  }

  function handleContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault()
    openMenu(event.clientX, event.clientY)
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    openMenu(rect.right - 224, rect.top + 40)
  }

  function runAction(action: DashboardAppointmentAction) {
    setMenuPosition(null)
    navigate(`/turnos/${turno.id}`, {
      state: action === 'detail' ? undefined : { dashboardAction: action },
    })
  }

  return (
    <article
      className="dashboard-appointment"
      data-highlighted={highlighted}
      onContextMenu={handleContextMenu}
      onKeyDown={handleMenuKeyDown}
    >
      <button
        type="button"
        className="dashboard-appointment__open"
        aria-label={`Ver turno de ${turno.paciente.nombre} a las ${formatLocalTime(turno.inicio)}`}
        onClick={() => runAction('detail')}
      >
        <span className="dashboard-appointment__rail">
          {highlighted ? <span>Próximo</span> : null}
          <strong>{formatLocalTime(turno.inicio)}</strong>
          <small>Hs</small>
        </span>

        <span className="dashboard-appointment__body">
          <strong>{turno.paciente.nombre}</strong>
          <span>{turno.prestacion.nombre}</span>
          <span className="dashboard-appointment__meta">
            <span>{turno.sillon.nombre}</span>
            <span>{turno.duracionMinutos} min</span>
          </span>
        </span>
      </button>

      <div className="dashboard-appointment__actions">
        <button
          type="button"
          className="dashboard-appointment__menu-trigger"
          aria-label={`Abrir acciones de ${turno.paciente.nombre}`}
          aria-haspopup="menu"
          aria-expanded={menuPosition !== null}
          onClick={(event) => {
            event.stopPropagation()
            if (menuPosition) {
              setMenuPosition(null)
              return
            }
            const rect = event.currentTarget.getBoundingClientRect()
            openMenu(rect.right - 224, rect.bottom + 6)
          }}
        >
          <DotsThreeVertical size={18} weight="bold" aria-hidden="true" />
        </button>
        <span className="dashboard-appointment__status" data-status={turno.estado}>
          {statusLabels[turno.estado]}
        </span>
      </div>

      {menuPosition ? (
        <div
          ref={menuRef}
          className="dashboard-context-menu"
          role="menu"
          aria-label={`Acciones del turno de ${turno.paciente.nombre}`}
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          <button type="button" role="menuitem" onClick={() => runAction('detail')}>
            <Eye size={20} aria-hidden="true" />
            <span>Ver detalle</span>
          </button>
          <button type="button" role="menuitem" disabled={terminal} onClick={() => runAction('reschedule')}>
            <ArrowsClockwise size={20} aria-hidden="true" />
            <span>Reprogramar</span>
          </button>
          <button type="button" role="menuitem" className="dashboard-context-menu__danger" disabled={terminal} onClick={() => runAction('cancel')}>
            <XCircle size={20} aria-hidden="true" />
            <span>Cancelar</span>
          </button>
        </div>
      ) : null}
    </article>
  )
}

export function PracticeDashboard() {
  const location = useLocation()
  const today = useMemo(() => todayLocal(), [])
  const [attempt, setAttempt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [page, setPage] = useState(1)
  const [load, setLoad] = useState<DashboardLoad>({ status: 'loading' })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

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

  const appointments = useMemo(
    () => load.status === 'ready'
      ? [...load.turnos].sort((first, second) => first.inicio.localeCompare(second.inicio))
      : [],
    [load],
  )
  const nextAppointment = appointments.find((turno) => isOperative(turno) && Date.parse(turno.inicio) >= now)
  const pendingCount = appointments.filter(({ estado }) => estado === 'PROGRAMADO').length
  const confirmedCount = appointments.filter(({ estado }) => estado === 'CONFIRMADO').length
  const totalPages = Math.max(1, Math.ceil(appointments.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleAppointments = appointments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <section className="practice-dashboard">
      <header className="dashboard-header">
        <div>
          <h1 className="page-heading">Inicio</h1>
          <p className="page-lead">Gestión diaria en tiempo real.</p>
        </div>

        {nextAppointment ? (
          <Link className="dashboard-next" to={`/turnos/${nextAppointment.id}`}>
            <span className="dashboard-next__countdown">
              <Clock size={16} weight="bold" aria-hidden="true" />
              {formatCountdown(nextAppointment.inicio, now)}
            </span>
            <span className="dashboard-next__copy">
              <small>Próximo turno con {nextAppointment.paciente.nombre}</small>
              <strong>Hoy · {formatLocalTime(nextAppointment.inicio)} Hs</strong>
            </span>
            <CaretDown size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      {load.status === 'loading' ? (
        <StatePanel state="loading" title="Cargando resumen" description="Consultando los turnos de hoy." />
      ) : null}

      {load.status === 'error' ? (
        <StatePanel
          state="error"
          title="No se pudo cargar el resumen de hoy"
          description="Intentá nuevamente en unos segundos."
          actionLabel="Reintentar"
          actionIcon={<ArrowClockwise size={16} />}
          onAction={() => setAttempt((value) => value + 1)}
        />
      ) : null}

      {load.status === 'ready' ? (
        <>
          <section className="dashboard-summary" aria-label="Resumen de hoy">
            <article aria-label={`Turnos hoy: ${appointments.length}`}>
              <div><small>Turnos hoy</small><strong>{appointments.length}</strong></div>
              <CalendarBlank size={20} aria-hidden="true" />
            </article>
            <article aria-label={`Pendientes: ${pendingCount}`}>
              <div><small>Pendientes</small><strong>{pendingCount}</strong></div>
              <Clock size={20} aria-hidden="true" />
            </article>
            <article className="dashboard-summary__confirmed" aria-label={`Confirmados: ${confirmedCount}`}>
              <div><small>Confirmados</small><strong>{confirmedCount}</strong></div>
              <SealCheck size={20} aria-hidden="true" />
            </article>
          </section>

          <section className="dashboard-agenda" aria-labelledby="dashboard-agenda-title">
            <header className="dashboard-agenda__header">
              <h2 id="dashboard-agenda-title">Hoy <span aria-hidden="true">•</span> {formatDashboardDate(today).replace(/^[^,]+,\s*/u, '')}</h2>
              <Link className="dashboard-agenda__scope" to="/agenda">
                <CalendarCheck size={15} aria-hidden="true" />
                Hoy ({appointments.length})
                <CaretDown size={14} aria-hidden="true" />
              </Link>
            </header>

            <div className="dashboard-agenda__body">
              {appointments.length === 0 ? (
                <div className="dashboard-empty" role="status">
                  <span><CalendarBlank size={25} aria-hidden="true" /></span>
                  <strong>Nada por acá</strong>
                  <p>No hay turnos agendados para hoy.</p>
                  <Link to="/turnos/nuevo" state={{ backgroundLocation: location }}>
                    <Plus size={15} weight="bold" aria-hidden="true" />
                    Crear turno
                  </Link>
                </div>
              ) : (
                visibleAppointments.map((turno) => (
                  <AppointmentRow
                    key={turno.id}
                    turno={turno}
                    highlighted={turno.id === nextAppointment?.id}
                  />
                ))
              )}
            </div>

            {appointments.length > 0 ? (
              <footer className="dashboard-pagination">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Anterior
                </button>
                <span>Página {currentPage} de {totalPages} · {appointments.length} turnos · {PAGE_SIZE} por página</span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  Siguiente
                </button>
              </footer>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  )
}
