import { PremiumCalendar } from '../../shared/components/PremiumCalendar'
import { DayOverview } from './DayOverview'
import type { AgendaDia } from './types'

interface Props {
  fecha: string
  today: string
  countsByDate: Record<string, number>
  dia?: AgendaDia
  onDateChange: (fecha: string) => void
}

export function AgendaCalendar({ fecha, today, countsByDate, dia, onDateChange }: Props) {
  return (
    <aside className="agenda-calendar-panel agenda-calendar-panel--shared" aria-label="Calendario mensual">
      <PremiumCalendar
        selectedDate={fecha}
        onDateSelect={onDateChange}
        visibleMonth={fecha.slice(0, 7)}
        onVisibleMonthChange={(month) => onDateChange(`${month}-01`)}
        todayDate={today}
        compact
        showShell={false}
        eventCountByDate={countsByDate}
      />
      <DayOverview dia={dia} />
    </aside>
  )
}
