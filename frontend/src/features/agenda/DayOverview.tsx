import { blockTypeLabel } from './status'
import { formatHourRange } from './time'
import type { AgendaDia } from './types'

export function DayOverview({ dia }: { dia: AgendaDia | undefined }) {
  if (!dia) return null
  return (
    <section className="agenda-day" aria-label="Disponibilidad del día">
      {dia.tramos.length > 0 ? (
        <p className="agenda-day__tramos">Disponibilidad: {dia.tramos.map((t) => formatHourRange(t.horaInicio, t.horaFin)).join(' · ')}</p>
      ) : (
        <p className="agenda-day__tramos">Sin horario de atención este día.</p>
      )}
      {dia.bloqueos.map((bloqueo) => (
        <p key={bloqueo.id} className="agenda-day__block" data-block-type={bloqueo.tipo}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><rect x="2.5" y="6" width="9" height="6.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          <strong>{blockTypeLabel(bloqueo.tipo)}</strong>
          <span>{bloqueo.horaInicio && bloqueo.horaFin ? formatHourRange(bloqueo.horaInicio, bloqueo.horaFin) : 'Todo el día'}</span>
          {bloqueo.motivo ? <span>{bloqueo.motivo}</span> : null}
        </p>
      ))}
    </section>
  )
}
