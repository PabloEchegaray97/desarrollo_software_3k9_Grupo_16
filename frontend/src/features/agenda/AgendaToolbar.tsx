import {
  CalendarBlank,
  FunnelSimple,
  ListBullets,
} from '@phosphor-icons/react'
import { AppButton } from '../../shared/components/Button'
import { SearchInput } from '../../shared/components/SearchInput'

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
      <SearchInput
        value={searchDraft}
        onChange={onSearchDraftChange}
        onSearch={onSearch}
        maxLength={80}
        placeholder="Buscar paciente, prestación o sillón"
        aria-label="Buscar por paciente, prestación o sillón"
      />

      <div className="agenda-toolbar__controls">
        <AppButton
          variant="secondary"
          leftIcon={<FunnelSimple />}
          rightIcon={hasActiveFilters ? <i className="agenda-toolbar__filter-dot" aria-hidden="true" /> : undefined}
          aria-expanded={filtersOpen}
          onClick={onToggleFilters}
        >
          Filtros
        </AppButton>

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
      </div>
    </div>
  )
}
