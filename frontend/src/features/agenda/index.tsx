import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { CalendarBlank, CalendarCheck, Clock, Plus, XCircle } from '@phosphor-icons/react'
import { StatePanel } from '../../shared/components/StatePanel'
import { AgendaCalendar } from './AgendaCalendar'
import { AgendaFilters } from './AgendaFilters'
import { AgendaToolbar, readAgendaViewPreference, writeAgendaViewPreference, type AgendaView } from './AgendaToolbar'
import { AppointmentDetail } from './AppointmentDetail'
import { AppointmentRow } from './AppointmentRow'
import { DayOverview } from './DayOverview'
import { isDefaultFilters, readViewState, toAgendaQuery, writeViewState, type AgendaViewState } from './agenda-params'
import { listChairs } from './api'
import type { AppointmentAgendaPageProps } from './contracts'
import { formatCivilDate, localDateFromInstant, todayLocal } from './time'
import { useAgenda } from './useAgenda'
import type { AgendaTurno, AppointmentStatus, ChairOption } from './types'
import './agenda.css'

export type { AgendaActionsContext, AgendaActionsRenderer, AppointmentAgendaPageProps } from './contracts'

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function matchesSearch(turno: AgendaTurno, query: string): boolean {
  if (!query) return true
  const fields = [turno.paciente.nombre, turno.prestacion.nombre, turno.sillon.nombre]
  return fields.some((value) => normalizeSearch(value).includes(query))
}

function getStatusCounts(turnos: readonly AgendaTurno[]): Record<AppointmentStatus, number> {
  return turnos.reduce<Record<AppointmentStatus, number>>((counts, turno) => {
    counts[turno.estado] += 1
    return counts
  }, { PROGRAMADO: 0, CONFIRMADO: 0, ATENDIDO: 0, AUSENTE: 0, CANCELADO: 0 })
}

function groupByLocalDate(turnos: readonly AgendaTurno[]): Array<{ fecha: string; turnos: AgendaTurno[] }> {
  const groups = new Map<string, AgendaTurno[]>()
  turnos.forEach((turno) => {
    const fecha = localDateFromInstant(turno.inicio)
    const current = groups.get(fecha) ?? []
    current.push(turno)
    groups.set(fecha, current)
  })
  return Array.from(groups, ([fecha, items]) => ({ fecha, turnos: items }))
}

export function AppointmentAgendaPage({ renderActions }: AppointmentAgendaPageProps = {}) {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const today = useMemo(() => todayLocal(), [])
  const view = useMemo(() => readViewState(params, today), [params, today])
  const [agendaView, setAgendaView] = useState<AgendaView>(() => readAgendaViewPreference())
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const query = useMemo(() => toAgendaQuery(view), [view])
  const { load, refresh, retry } = useAgenda(query)

  const [chairs, setChairs] = useState<ChairOption[]>([])
  const [chairsError, setChairsError] = useState(false)
  const [chairsAttempt, setChairsAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setChairsError(false)
    listChairs(controller.signal)
      .then(setChairs)
      .catch(() => { if (!controller.signal.aborted) setChairsError(true) })
    return () => controller.abort()
  }, [chairsAttempt])

  const update = useCallback((patch: Partial<AgendaViewState>, options: { keepTurno?: boolean } = {}) => {
    setNotice(null)
    setParams(writeViewState({
      ...view,
      ...patch,
      turnoId: options.keepTurno ? view.turnoId : undefined,
      ...(patch.turnoId ? { turnoId: patch.turnoId } : {}),
    }, today))
  }, [setParams, today, view])

  const allTurnos = load.status === 'ready' ? load.data.turnos : []
  const searchQuery = normalizeSearch(appliedSearch)
  const filteredTurnos = useMemo(
    () => allTurnos.filter((turno) => matchesSearch(turno, searchQuery)),
    [allTurnos, searchQuery],
  )
  const selectedDayTurnos = useMemo(
    () => filteredTurnos.filter((turno) => localDateFromInstant(turno.inicio) === view.fecha),
    [filteredTurnos, view.fecha],
  )
  const visibleTurnos = agendaView === 'grid' ? selectedDayTurnos : filteredTurnos
  const groupedTurnos = useMemo(() => groupByLocalDate(filteredTurnos), [filteredTurnos])
  const selected = visibleTurnos.find((turno) => turno.id === view.turnoId)
  const dia = load.status === 'ready' ? load.data.dias.find((item) => item.fecha === view.fecha) : undefined
  const statusCounts = getStatusCounts(filteredTurnos)
  const filtersApplied = !isDefaultFilters(view) || Boolean(appliedSearch.trim())
  const countsByDate = useMemo(() => filteredTurnos.reduce<Record<string, number>>((counts, turno) => {
    const fecha = localDateFromInstant(turno.inicio)
    counts[fecha] = (counts[fecha] ?? 0) + 1
    return counts
  }, {}), [filteredTurnos])

  useEffect(() => {
    if (load.status === 'ready' && !load.refreshing && view.turnoId && !selected) {
      setNotice('El turno que estabas viendo ya no figura en esta lista.')
      setParams(writeViewState({ ...view, turnoId: undefined }, today), { replace: true })
    }
  }, [load, selected, setParams, today, view])

  const closeDetail = () => {
    const id = view.turnoId
    update({}, { keepTurno: false })
    if (id) window.setTimeout(() => document.querySelector<HTMLElement>(`[data-turno-id="${id}"]`)?.focus(), 0)
  }
  const select = (turno: AgendaTurno) => update({ turnoId: turno.id }, { keepTurno: true })
  const changeAgendaView = (nextView: AgendaView) => {
    setAgendaView(nextView)
    writeAgendaViewPreference(nextView)
  }
  const applySearch = () => {
    setAppliedSearch(searchDraft.trim())
    setNotice(null)
  }
  const clearFilters = () => {
    setSearchDraft('')
    setAppliedSearch('')
    setFiltersOpen(false)
    update({ sillonId: undefined, estados: readViewState(new URLSearchParams(), today).estados })
  }

  const emptyTitle = filtersApplied
    ? 'Ningún turno coincide con los filtros'
    : agendaView === 'grid'
      ? 'No hay turnos para esta fecha'
      : 'No hay turnos para este mes'
  const emptyDescription = filtersApplied
    ? 'Probá ajustar la búsqueda o limpiar los filtros.'
    : agendaView === 'grid'
      ? 'La agenda de este día está libre.'
      : 'No hay turnos registrados en el mes visible.'

  return (
    <section className="agenda agenda-page">
      <header className="agenda-page-header">
        <div>
          <h1 className="page-heading">Turnos</h1>
          <p className="page-lead">Supervisá la operación diaria de tus reservas.</p>
        </div>
        <Link
          className="agenda-page-header__create"
          to="/turnos/nuevo"
          state={{ backgroundLocation: location }}
        >
          <Plus size={16} aria-hidden="true" />
          <span>Nuevo turno</span>
        </Link>
      </header>

      <section className="agenda-summary" aria-label="Resumen del mes visible">
        <article className="agenda-summary__item">
          <span><small>Total</small><strong>{load.status === 'ready' ? filteredTurnos.length : '—'}</strong></span>
          <CalendarBlank size={20} aria-hidden="true" />
        </article>
        <article className="agenda-summary__item" data-tone="pending">
          <span><small>Pendientes</small><strong>{load.status === 'ready' ? statusCounts.PROGRAMADO : '—'}</strong></span>
          <Clock size={20} aria-hidden="true" />
        </article>
        <article className="agenda-summary__item" data-tone="cancelled">
          <span><small>Cancelados</small><strong>{load.status === 'ready' ? statusCounts.CANCELADO : '—'}</strong></span>
          <XCircle size={20} aria-hidden="true" />
        </article>
      </section>

      <div className={`agenda-experience${agendaView === 'grid' ? ' agenda-experience--calendar' : ''}`}>
        {agendaView === 'grid' ? (
          <AgendaCalendar
            fecha={view.fecha}
            today={today}
            countsByDate={countsByDate}
            onDateChange={(fecha) => update({ fecha })}
          />
        ) : null}

        <section className="agenda-main-panel" aria-label="Turnos">
          <AgendaToolbar
            searchDraft={searchDraft}
            onSearchDraftChange={setSearchDraft}
            onSearch={applySearch}
            view={agendaView}
            onViewChange={changeAgendaView}
            filtersOpen={filtersOpen}
            hasActiveFilters={filtersApplied}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            refreshing={load.status === 'ready' && load.refreshing}
            generadoEn={load.status === 'ready' ? load.data.generadoEn : null}
            onRefresh={() => { setNotice(null); void refresh() }}
          />

          <div
            id="agenda-filters-panel"
            className="agenda-filters-panel"
            hidden={!filtersOpen}
          >
            <AgendaFilters
              chairs={chairs}
              chairsError={chairsError}
              onRetryChairs={() => setChairsAttempt((attempt) => attempt + 1)}
              sillonId={view.sillonId}
              estados={view.estados}
              canClear={filtersApplied}
              onSillonChange={(sillonId) => update({ sillonId })}
              onEstadosChange={(estados) => update({ estados })}
              onClear={clearFilters}
            />
          </div>

          {notice ? <p className="agenda-notice" role="status">{notice}</p> : null}
          {load.status === 'ready' && load.refreshError ? (
            <p className="agenda-notice" data-tone="error" role="alert">
              No se pudo actualizar; se muestran los datos anteriores. {load.refreshError.message}
              {load.refreshError.requestId ? ` (ref. ${load.refreshError.requestId})` : ''}
            </p>
          ) : null}

          <header className="agenda-main-panel__heading">
            <div>
              <h2>{agendaView === 'grid' ? formatCivilDate(view.fecha) : 'Todos los turnos del mes'}</h2>
              <p>
                {load.status === 'ready'
                  ? `${visibleTurnos.length} ${visibleTurnos.length === 1 ? 'turno' : 'turnos'}${agendaView === 'grid' ? ' para esta fecha' : ' en el período'}`
                  : 'Consultá la agenda por fecha y estado.'}
              </p>
            </div>
            {agendaView === 'grid' ? <CalendarCheck size={20} aria-hidden="true" /> : null}
          </header>

          {load.status === 'idle' ? (
            <StatePanel state="empty" title="Sin estados elegidos" description="Elegí al menos un estado para ver turnos." />
          ) : null}
          {load.status === 'loading' ? (
            <StatePanel state="loading" title="Cargando turnos" description="Buscando los turnos del mes visible." />
          ) : null}
          {load.status === 'error' ? (
            <StatePanel
              state="error"
              title={load.problem.kind === 'range' ? 'Fecha rechazada' : 'No se pudo cargar la agenda'}
              description={load.problem.message}
              actionLabel={load.problem.kind === 'range' ? undefined : 'Reintentar'}
              onAction={retry}
            />
          ) : null}
          {load.status === 'ready' ? (
            <>
              {agendaView === 'grid' ? <DayOverview dia={dia} /> : null}
              {visibleTurnos.length === 0 ? (
                <StatePanel state="empty" title={emptyTitle} description={emptyDescription} />
              ) : (
                <div className={`agenda-results${selected ? ' agenda-results--detail' : ''}`}>
                  <div className="agenda-results__list">
                    {agendaView === 'grid' ? (
                      <ul className="agenda-list__items" aria-label="Turnos del día">
                        {selectedDayTurnos.map((turno) => (
                          <AppointmentRow key={turno.id} turno={turno} selected={turno.id === view.turnoId} onSelect={select} />
                        ))}
                      </ul>
                    ) : (
                      <div className="agenda-month-list">
                        {groupedTurnos.map(({ fecha, turnos }) => (
                          <section className="agenda-month-list__day" key={fecha}>
                            <h3>{formatCivilDate(fecha)}</h3>
                            <ul className="agenda-list__items" aria-label={`Turnos del ${formatCivilDate(fecha)}`}>
                              {turnos.map((turno) => (
                                <AppointmentRow key={turno.id} turno={turno} selected={turno.id === view.turnoId} onSelect={select} />
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    )}
                  </div>
                  {selected ? (
                    <AppointmentDetail turno={selected} onClose={closeDetail} onChanged={() => void refresh()} renderActions={renderActions} />
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>
    </section>
  )
}
