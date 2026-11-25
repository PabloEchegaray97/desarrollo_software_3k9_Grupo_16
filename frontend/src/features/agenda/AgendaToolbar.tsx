import {
  ArrowClockwise,
  CalendarBlank,
  FunnelSimple,
  ListBullets,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { formatLocalTime } from './time'

export const AGENDA_VIEW_STORAGE_KEY = 'odosoft.agenda-view'
export type AgendaView = 'list' | 'grid'

function isAgendaView(value: string | null): value is AgendaView {
  return value === 'list' || value === 'grid'
}

export function readAgendaViewPreference(storage?: Pick<Storage, 'getItem'>): AgendaView {
  try {
    const stored = (storage ?? window.localStorage).getItem(AGENDA_VIEW_STORAGE_KEY)
    return isAgendaView(stored) ? stored : 'grid'
  } catch {
    return 'grid'
  }
}

export function writeAgendaViewPreference(view: AgendaView, storage?: Pick<Storage, 'setItem'>): void {
  try {
    const target = storage ?? window.localStorage
    target.setItem(AGENDA_VIEW_STORAGE_KEY, view)
  } catch {
    // The active view remains usable if browser storage is unavailable.
  }
}

interface Props {
  searchDraft: string
  onSearchDraftChange: (value: string) => void
  onSearch: () => void
  view: AgendaView
  onViewChange: (view: AgendaView) => void
  filtersOpen: boolean
  hasActiveFilters: boolean
  onToggleFilters: () => void
  refreshing: boolean
  generadoEn: string | null
  onRefresh: () => void
}

export function AgendaToolbar({
  searchDraft,
  onSearchDraftChange,
  onSearch,
  view,
  onViewChange,
  filtersOpen,
  hasActiveFilters,
  onToggleFilters,
  refreshing,
  generadoEn,
  onRefresh,
}: Props) {
  return (
    <div className="agenda-toolbar">
      <form
        className="agenda-toolbar__search"
        aria-label="Buscar turnos del mes visible"
        onSubmit={(event) => {
          event.preventDefault()
          onSearch()
        }}
      >
        <label className="agenda-toolbar__search-field">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <span className="agenda-visually-hidden">Buscar por paciente, prestación o sillón</span>
          <input
            className="agenda-toolbar__search-input"
            type="search"
            maxLength={80}
            value={searchDraft}
            onChange={(event) => onSearchDraftChange(event.target.value)}
            placeholder="Buscar paciente, prestación o sillón"
          />
        </label>
        <button type="submit" className="agenda-action-button agenda-action-button--primary">
          <MagnifyingGlass size={16} aria-hidden="true" />
          <span>Buscar</span>
        </button>
      </form>

      <div className="agenda-toolbar__controls">
        <button
          type="button"
          className="agenda-action-button"
          aria-expanded={filtersOpen}
          aria-controls="agenda-filters-panel"
          onClick={onToggleFilters}
        >
          <FunnelSimple size={16} aria-hidden="true" />
          <span>Filtros</span>
          {hasActiveFilters ? <i className="agenda-toolbar__filter-dot" aria-hidden="true" /> : null}
        </button>

        <div className="agenda-toolbar__view" role="group" aria-label="Vista de turnos">
          <button type="button" aria-pressed={view === 'list'} onClick={() => onViewChange('list')}>
            <ListBullets size={16} aria-hidden="true" />
            <span>Lista</span>
          </button>
          <button type="button" aria-pressed={view === 'grid'} onClick={() => onViewChange('grid')}>
            <CalendarBlank size={16} aria-hidden="true" />
            <span>Calendario</span>
          </button>
        </div>

        <button type="button" className="agenda-action-button agenda-action-button--refresh" onClick={onRefresh} disabled={refreshing}>
          <ArrowClockwise size={16} aria-hidden="true" />
          <span>{refreshing ? 'Actualizando…' : 'Actualizar'}</span>
        </button>
      </div>

      {generadoEn ? <p className="agenda-toolbar__stamp">Actualizado a las {formatLocalTime(generadoEn)}</p> : null}
    </div>
  )
}
