import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { AgendaFilters } from './AgendaFilters'
import { AgendaGrid } from './AgendaGrid'
import { AgendaToolbar, readAgendaViewPreference, writeAgendaViewPreference, type AgendaView } from './AgendaToolbar'
import { AppointmentDetail } from './AppointmentDetail'
import { AppointmentRow } from './AppointmentRow'
import { DayOverview } from './DayOverview'
import { isDefaultFilters, readViewState, toAgendaQuery, writeViewState, type AgendaViewState } from './agenda-params'
import { listChairs } from './api'
import type { AppointmentAgendaPageProps } from './contracts'
import { todayLocal } from './time'
import { useAgenda } from './useAgenda'
import type { AgendaTurno, ChairOption } from './types'
import './agenda.css'

export type { AgendaActionsContext, AgendaActionsRenderer, AppointmentAgendaPageProps } from './contracts'

export function AppointmentAgendaPage({ renderActions }: AppointmentAgendaPageProps = {}) {
  const [params, setParams] = useSearchParams()
  const today = useMemo(() => todayLocal(), [])
  const view = useMemo(() => readViewState(params, today), [params, today])
  const [agendaView, setAgendaView] = useState<AgendaView>(() => readAgendaViewPreference())
  const query = useMemo(() => toAgendaQuery(view), [view])
  const { load, refresh, retry } = useAgenda(query)

  const [chairs, setChairs] = useState<ChairOption[]>([])
  const [chairsError, setChairsError] = useState(false)
  const [chairsAttempt, setChairsAttempt] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

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
    setParams(writeViewState({ ...view, ...patch, turnoId: options.keepTurno ? view.turnoId : undefined, ...(patch.turnoId ? { turnoId: patch.turnoId } : {}) }, today))
  }, [setParams, today, view])

  const turnos = load.status === 'ready' ? load.data.turnos : []
  const selected = turnos.find((turno) => turno.id === view.turnoId)

  // Si el turno abierto ya no está tras un refresco, se cierra con un aviso.
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

  const dia = load.status === 'ready' ? load.data.dias.find((d) => d.fecha === view.fecha) : undefined
  const filtered = !isDefaultFilters(view)

  return (
    <section className="agenda">
      <h1 className="page-heading">Agenda</h1>
      <AgendaToolbar
        fecha={view.fecha}
        today={today}
        generadoEn={load.status === 'ready' ? load.data.generadoEn : null}
        refreshing={load.status === 'ready' && load.refreshing}
        view={agendaView}
        onDateChange={(fecha) => update({ fecha })}
        onRefresh={() => { setNotice(null); void refresh() }}
        onViewChange={changeAgendaView}
      />
      <AgendaFilters
        chairs={chairs}
        chairsError={chairsError}
        onRetryChairs={() => setChairsAttempt((n) => n + 1)}
        sillonId={view.sillonId}
        estados={view.estados}
        canClear={filtered}
        onSillonChange={(sillonId) => update({ sillonId })}
        onEstadosChange={(estados) => update({ estados })}
        onClear={() => update({ sillonId: undefined, estados: readViewState(new URLSearchParams(), today).estados })}
      />
      {notice ? <p className="agenda-notice" role="status">{notice}</p> : null}
      {load.status === 'ready' && load.refreshError ? (
        <p className="agenda-notice" data-tone="error" role="alert">
          No se pudo actualizar; se muestran los datos anteriores. {load.refreshError.message}
          {load.refreshError.requestId ? ` (ref. ${load.refreshError.requestId})` : ''}
        </p>
      ) : null}
      <div className="agenda-layout">
        <div className="agenda-list">
          {load.status === 'idle' ? <StatePanel state="empty" title="Sin estados elegidos" description="Elegí al menos un estado para ver turnos." /> : null}
          {load.status === 'loading' ? <StatePanel state="loading" title="Cargando agenda" description="Buscando los turnos del día." /> : null}
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
              <DayOverview dia={dia} />
              {turnos.length === 0 ? (
                <StatePanel
                  state="empty"
                  title={filtered ? 'Ningún turno coincide con los filtros' : 'No hay turnos para esta fecha'}
                  description={filtered ? 'Probá limpiar los filtros.' : 'La agenda de este día está libre.'}
                />
              ) : agendaView === 'grid' ? (
                <AgendaGrid turnos={turnos} selectedId={view.turnoId} onSelect={select} />
              ) : (
                <ul className="agenda-list__items" aria-label="Turnos del día">
                  {turnos.map((turno) => (
                    <AppointmentRow key={turno.id} turno={turno} selected={turno.id === view.turnoId} onSelect={select} />
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
        {selected ? (
          <AppointmentDetail turno={selected} onClose={closeDetail} onChanged={() => void refresh()} renderActions={renderActions} />
        ) : null}
      </div>
    </section>
  )
}
