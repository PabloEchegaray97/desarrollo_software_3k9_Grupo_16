import { STATUS_PRESENTATION } from './status'
import { APPOINTMENT_STATUSES, type AppointmentStatus, type ChairOption } from './types'

interface Props {
  chairs: ChairOption[]
  chairsError: boolean
  onRetryChairs: () => void
  sillonId?: string
  estados: AppointmentStatus[]
  canClear: boolean
  onSillonChange: (id: string | undefined) => void
  onEstadosChange: (estados: AppointmentStatus[]) => void
  onClear: () => void
}

export function AgendaFilters({ chairs, chairsError, onRetryChairs, sillonId, estados, canClear, onSillonChange, onEstadosChange, onClear }: Props) {
  const toggle = (status: AppointmentStatus, checked: boolean) => {
    const next = new Set(estados)
    if (checked) next.add(status)
    else next.delete(status)
    onEstadosChange(APPOINTMENT_STATUSES.filter((s) => next.has(s)))
  }
  return (
    <form className="agenda-filters" aria-label="Filtros de la agenda" onSubmit={(event) => event.preventDefault()}>
      <label className="agenda-filters__field">
        <span>Sillón</span>
        <select value={sillonId ?? ''} onChange={(event) => onSillonChange(event.target.value || undefined)}>
          <option value="">Todos los sillones</option>
          {chairs.map((chair) => (
            <option key={chair.id} value={chair.id}>{chair.nombre}{chair.activo ? '' : ' (inactivo)'}</option>
          ))}
        </select>
      </label>
      {chairsError ? (
        <p className="agenda-filters__error" role="alert">
          No se pudieron cargar los sillones. <button type="button" onClick={onRetryChairs}>Reintentar</button>
        </p>
      ) : null}
      <fieldset className="agenda-filters__states">
        <legend>Estado</legend>
        {APPOINTMENT_STATUSES.map((status) => (
          <label key={status}>
            <input type="checkbox" checked={estados.includes(status)} onChange={(event) => toggle(status, event.target.checked)} />
            <span>{STATUS_PRESENTATION[status].label}</span>
          </label>
        ))}
      </fieldset>
      {estados.length === 0 ? <p className="agenda-filters__hint" role="status">Elegí al menos un estado para ver turnos.</p> : null}
      <button type="button" onClick={onClear} disabled={!canClear}>Limpiar filtros</button>
    </form>
  )
}
