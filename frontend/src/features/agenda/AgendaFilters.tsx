import { ArrowClockwise } from '@phosphor-icons/react'
import { useState } from 'react'
import { FilterModal } from '../../shared/components/FilterModal'
import { STATUS_PRESENTATION } from './status'
import { APPOINTMENT_STATUSES, type AppointmentStatus, type ChairOption } from './types'

type EstadoSelection = AppointmentStatus | 'all'

interface Props {
  open: boolean
  chairs: ChairOption[]
  chairsError: boolean
  onRetryChairs: () => void
  sillonId?: string
  estados: AppointmentStatus[]
  onSillonChange: (id: string | undefined) => void
  onEstadosChange: (estados: AppointmentStatus[]) => void
  onClose: () => void
  onClear: () => void
  onApply: () => void
}

function toSelection(estados: readonly AppointmentStatus[]): EstadoSelection {
  return estados.length === APPOINTMENT_STATUSES.length ? 'all' : (estados[0] ?? 'all')
}

export function AgendaFilters({
  open,
  chairs,
  chairsError,
  onRetryChairs,
  sillonId,
  estados,
  onSillonChange,
  onEstadosChange,
  onClose,
  onClear,
  onApply,
}: Props) {
  const [selected, setSelected] = useState<EstadoSelection>(() => toSelection(estados))

  const handleSelect = (value: EstadoSelection) => {
    setSelected(value)
    onEstadosChange(value === 'all' ? [...APPOINTMENT_STATUSES] : [value as AppointmentStatus])
  }

  const handleClear = () => {
    setSelected('all')
    onClear()
  }

  return (
    <FilterModal
      open={open}
      title="Filtros"
      description="Filtrá por sillón y estado."
      onClose={onClose}
      onClear={handleClear}
      onApply={onApply}
    >
      <div className="filter-modal__field">
        <label htmlFor="agenda-filter-sillon">Sillón</label>
        <select
          id="agenda-filter-sillon"
          value={sillonId ?? ''}
          onChange={(event) => onSillonChange(event.target.value || undefined)}
        >
          <option value="">Todos los sillones</option>
          {chairs.map((chair) => (
            <option key={chair.id} value={chair.id}>{chair.nombre}{chair.activo ? '' : ' (inactivo)'}</option>
          ))}
        </select>
      </div>
      {chairsError ? (
        <p className="agenda-filters__error" role="alert">
          No se pudieron cargar los sillones.
          <button type="button" className="agenda-action-button" onClick={onRetryChairs}>
            <ArrowClockwise size={16} aria-hidden="true" />
            Reintentar
          </button>
        </p>
      ) : null}
      <fieldset className="agenda-filters__states">
        <legend>Estado</legend>
        <div className="agenda-filters__status-list">
          <label className="agenda-filters__status-option">
            <input
              type="radio"
              name="agenda-estado"
              value="all"
              checked={selected === 'all'}
              onChange={() => handleSelect('all')}
            />
            <span>Todos</span>
          </label>
          {APPOINTMENT_STATUSES.map((status) => (
            <label key={status} className="agenda-filters__status-option">
              <input
                type="radio"
                name="agenda-estado"
                value={status}
                checked={selected === status}
                onChange={() => handleSelect(status)}
              />
              <span>{STATUS_PRESENTATION[status].label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </FilterModal>
  )
}
