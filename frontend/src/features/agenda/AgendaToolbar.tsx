import { addDaysToLocalDate, formatCivilDate, formatLocalTime, isValidLocalDate } from './time'

interface Props {
  fecha: string
  today: string
  generadoEn: string | null
  refreshing: boolean
  onDateChange: (fecha: string) => void
  onRefresh: () => void
}

export function AgendaToolbar({ fecha, today, generadoEn, refreshing, onDateChange, onRefresh }: Props) {
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
      <div className="agenda-toolbar__refresh">
        <button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Actualizando…' : 'Actualizar'}</button>
        {generadoEn ? <span className="agenda-toolbar__stamp">Actualizado a las {formatLocalTime(generadoEn)}</span> : null}
      </div>
    </div>
  )
}
