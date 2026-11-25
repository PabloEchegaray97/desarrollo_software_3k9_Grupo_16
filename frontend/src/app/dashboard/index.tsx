import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
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
import { subscribeToAppointmentChanges } from '../../features/appointments/events'
import { AppointmentDetail } from '../../features/agenda/AppointmentDetail'
import { StatusBadge } from '../../features/agenda/StatusBadge'
import { formatCivilDate, formatLocalTime, localDateFromInstant, todayLocal } from '../../features/agenda/time'
import type { AgendaTurno } from '../../features/agenda/types'
import { AppointmentActionSheet } from '../../shared/components/AppointmentActionSheet'
import { StatePanel } from '../../shared/components/StatePanel'
import '../../features/agenda/agenda.css'
import './dashboard.css'

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [5, 10, 20] as const

type DashboardLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; today: AgendaTurno[]; upcoming: AgendaTurno[] }

type DashboardScope = 'today' | 'upcoming'

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

function AppointmentRow({
  turno,
  highlighted,
  selected,
  onSelect,
}: {
  turno: AgendaTurno
  highlighted: boolean
  selected: boolean
  onSelect: (turno: AgendaTurno) => void
}) {
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
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
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 48rem)').matches) {
      setMenuPosition(null)
      setSheetOpen(true)
      return
    }

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
    setSheetOpen(false)
    if (action === 'detail' && !(typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 48rem)').matches)) {
      onSelect(turno)
      return
    }
    navigate(`/turnos/${turno.id}`, {
      state: action === 'detail' ? undefined : { dashboardAction: action },
    })
  }

  function handlePrimaryAction() {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 48rem)').matches) {
      setSheetOpen(true)
      return
    }

    onSelect(turno)
  }

  return (
    <article
      className="dashboard-appointment"
      data-highlighted={highlighted}
      data-selected={selected}
      onContextMenu={handleContextMenu}
      onKeyDown={handleMenuKeyDown}
    >
      <button
        type="button"
        className="dashboard-appointment__open"
        aria-pressed={selected}
        aria-label={`Ver turno de ${turno.paciente.nombre} a las ${formatLocalTime(turno.inicio)}`}
        onClick={handlePrimaryAction}
      >
        <span className="dashboard-appointment__rail">
          {highlighted ? <span>Próximo</span> : null}
          <strong>{formatLocalTime(turno.inicio)} - {formatLocalTime(turno.finAtencion)}</strong>
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
          aria-expanded={menuPosition !== null || sheetOpen}
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
        <span className="dashboard-appointment__status">
          <StatusBadge estado={turno.estado} />
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

      <AppointmentActionSheet
        open={sheetOpen}
        patientName={turno.paciente.nombre}
        timeRange={`${formatLocalTime(turno.inicio)} - ${formatLocalTime(turno.finAtencion)}`}
        serviceName={turno.prestacion.nombre}
        terminal={terminal}
        onClose={() => setSheetOpen(false)}
        onDetail={() => runAction('detail')}
        onReschedule={() => runAction('reschedule')}
        onCancel={() => runAction('cancel')}
      />
    </article>
  )
}

export function PracticeDashboard() {
  const location = useLocation()
  const today = useMemo(() => todayLocal(), [])
  const [attempt, setAttempt] = useState(0)
  const [scope, setScope] = useState<DashboardScope>('today')
  const [now, setNow] = useState(() => Date.now())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [load, setLoad] = useState<DashboardLoad>({ status: 'loading' })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => subscribeToAppointmentChanges(() => setAttempt((value) => value + 1)), [])

  useEffect(() => {
    const controller = new AbortController()
    setLoad({ status: 'loading' })

    Promise.all([
      agendaApi.get({ desde: today, hasta: today }, controller.signal),
      agendaApi.getUpcoming(today, controller.signal),
    ])
      .then(([daily, upcoming]) => {
        if (!controller.signal.aborted) setLoad({ status: 'ready', today: daily.turnos, upcoming: upcoming.turnos })
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: 'error' })
      })

    return () => controller.abort()
  }, [attempt, today])

  const appointments = useMemo(
    () => load.status === 'ready'
      ? [...(scope === 'today' ? load.today : load.upcoming)].sort((first, second) => first.inicio.localeCompare(second.inicio))
      : [],
    [load, scope],
  )
  const todayAppointments = load.status === 'ready' ? load.today : []
  const upcomingAppointments = load.status === 'ready' ? load.upcoming : []
  const nextAppointment = upcomingAppointments.find((turno) => isOperative(turno) && Date.parse(turno.inicio) >= now)
  const pendingCount = todayAppointments.filter(({ estado }) => estado === 'PROGRAMADO').length
  const confirmedCount = todayAppointments.filter(({ estado }) => estado === 'CONFIRMADO').length
  const totalPages = Math.max(1, Math.ceil(appointments.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleAppointments = appointments.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedAppointment = appointments.find(({ id }) => id === selectedId)

  useEffect(() => {
    if (!nextAppointment) return
    const nextIndex = appointments.findIndex(({ id }) => id === nextAppointment.id)
    if (nextIndex < 0) return
    setPage(Math.floor(nextIndex / pageSize) + 1)
  }, [appointments, nextAppointment, pageSize])

  function changeScope(nextScope: DashboardScope) {
    setScope(nextScope)
    setSelectedId(null)
    setPage(1)
  }

  return (
    <section className="practice-dashboard">
      <header className="dashboard-header">
        <div>
          <h1 className="page-heading">Inicio</h1>
          <p className="page-lead">Gestión diaria en tiempo real.</p>
        </div>

        {nextAppointment ? (
          <button
            type="button"
            className="dashboard-next"
            onClick={() => {
              if (localDateFromInstant(nextAppointment.inicio) !== today) setScope('upcoming')
              setSelectedId(nextAppointment.id)
            }}
          >
            <span className="dashboard-next__countdown">
              <Clock size={16} weight="bold" aria-hidden="true" />
              {formatCountdown(nextAppointment.inicio, now)}
            </span>
            <span className="dashboard-next__copy">
              <small>Próximo turno con {nextAppointment.paciente.nombre}</small>
              <strong>
                {localDateFromInstant(nextAppointment.inicio) === today
                  ? 'Hoy'
                  : formatDashboardDate(localDateFromInstant(nextAppointment.inicio))}
                {' · '}{formatLocalTime(nextAppointment.inicio)} Hs
              </strong>
            </span>
            <CaretDown size={15} aria-hidden="true" />
          </button>
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
            <article aria-label={`Turnos hoy: ${todayAppointments.length}`}>
              <div><small>Turnos hoy</small><strong>{todayAppointments.length}</strong></div>
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
              <h2 id="dashboard-agenda-title">
                {scope === 'today'
                  ? <>Hoy <span aria-hidden="true">•</span> {formatDashboardDate(today).replace(/^[^,]+,\s*/u, '')}</>
                  : 'Próximos turnos'}
              </h2>
              <label className="dashboard-agenda__scope">
                <CalendarCheck size={15} aria-hidden="true" />
                <select
                  aria-label="Período de turnos"
                  value={scope}
                  onChange={(event) => changeScope(event.target.value as DashboardScope)}
                >
                  <option value="today">Hoy ({todayAppointments.length})</option>
                  <option value="upcoming">Próximos turnos ({upcomingAppointments.length})</option>
                </select>
                <CaretDown size={14} aria-hidden="true" />
              </label>
            </header>

            <div className={`dashboard-agenda__content${selectedAppointment ? ' dashboard-agenda__content--detail' : ''}`}>
              <div className="dashboard-agenda__list">
                <div className="dashboard-agenda__body">
                  {appointments.length === 0 ? (
                    <div className="dashboard-empty" role="status">
                      <CalendarBlank size={34} weight="fill" aria-hidden="true" />
                      <p>{scope === 'today' ? 'La agenda está libre este día.' : 'No hay próximos turnos programados.'}</p>
                      <Link className="dashboard-empty__action" to="/turnos/nuevo" state={{ backgroundLocation: location }}>
                        <Plus size={15} weight="bold" aria-hidden="true" />
                        Crear turno
                      </Link>
                    </div>
                  ) : (
                    visibleAppointments.map((turno, index) => {
                      const appointmentDate = localDateFromInstant(turno.inicio)
                      const previousDate = index === 0 ? null : localDateFromInstant(visibleAppointments[index - 1]!.inicio)
                      return (
                        <Fragment key={turno.id}>
                          {scope === 'upcoming' && appointmentDate !== previousDate ? (
                            <h3 className="dashboard-agenda__day">{formatDashboardDate(appointmentDate)}</h3>
                          ) : null}
                          <AppointmentRow
                            turno={turno}
                            highlighted={turno.id === nextAppointment?.id}
                            selected={turno.id === selectedId}
                            onSelect={(appointment) => setSelectedId(appointment.id)}
                          />
                        </Fragment>
                      )
                    })
                  )}
                </div>

                <footer className="dashboard-pagination">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => { setSelectedId(null); setPage((value) => Math.max(1, value - 1)) }}
                  >
                    Anterior
                  </button>
                  <div className="dashboard-pagination__center">
                    <span>Página {currentPage} de {totalPages} · {appointments.length} turnos</span>
                    <label>
                      <span>Mostrar</span>
                      <select
                        aria-label="Turnos por página"
                        value={pageSize}
                        onChange={(event) => {
                          setSelectedId(null)
                          setPage(1)
                          setPageSize(Number(event.target.value))
                        }}
                      >
                        {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => { setSelectedId(null); setPage((value) => Math.min(totalPages, value + 1)) }}
                  >
                    Siguiente
                  </button>
                </footer>
              </div>

              {selectedAppointment ? (
                <AppointmentDetail
                  turno={selectedAppointment}
                  onClose={() => setSelectedId(null)}
                  onChanged={() => setAttempt((value) => value + 1)}
                />
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </section>
  )
}
