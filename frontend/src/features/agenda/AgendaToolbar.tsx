import { addDaysToLocalDate, formatCivilDate, formatLocalTime, isValidLocalDate } from './time'

export const AGENDA_VIEW_STORAGE_KEY = 'odosoft.agenda-view'
export type AgendaView = 'list' | 'grid'

function isAgendaView(value: string | null): value is AgendaView {
  return value === 'list' || value === 'grid'
}

export function readAgendaViewPreference(storage?: Pick<Storage, 'getItem'>): AgendaView {
  try {
    const stored = (storage ?? window.localStorage).getItem(AGENDA_VIEW_STORAGE_KEY)
    return isAgendaView(stored) ? stored : 'list'
  } catch {
    return 'list'
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
  fecha: string
  today: string
  generadoEn: string | null
  refreshing: boolean
  view: AgendaView
  onDateChange: (fecha: string) => void
  onRefresh: () => void
  onViewChange: (view: AgendaView) => void
}

export function AgendaToolbar({ fecha, today, generadoEn, refreshing, view, onDateChange, onRefresh, onViewChange }: Props) {
  return (
    <div className="agenda-toolbar">
      <h2 className="agenda-toolbar__title">{formatCivilDate(fecha)}</h2>
      <div className="agenda-toolbar__nav" role="group" aria-label="Navegar por fecha">
        <button type="button" onClick={() => onDateChange(addDaysToLocalDate(fecha, -1))}>Día anterior</button>
        <button type="button" onClick={() => onDateChange(today)} disabled={fecha === today}>Hoy</button>
        <button type="button" onClick={() => onDateChange(addDaysToLocalDate(fecha, 1))}>Día siguiente</button>
        <label className="agenda-toolbar__date">
          <span>Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(event) => { if (isValidLocalDate(event.target.value)) onDateChange(event.target.value) }}
          />
        </label>
      </div>
      <div className="agenda-toolbar__view" role="group" aria-label="Vista de agenda">
        <button type="button" aria-pressed={view === 'list'} onClick={() => onViewChange('list')}>Lista</button>
        <button type="button" aria-pressed={view === 'grid'} onClick={() => onViewChange('grid')}>Grilla</button>
      </div>
      <div className="agenda-toolbar__refresh">
        <button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Actualizando…' : 'Actualizar'}</button>
        {generadoEn ? <span className="agenda-toolbar__stamp">Actualizado a las {formatLocalTime(generadoEn)}</span> : null}
      </div>
    </div>
  )
}
