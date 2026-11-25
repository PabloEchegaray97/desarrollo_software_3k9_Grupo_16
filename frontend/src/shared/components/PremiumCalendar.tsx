import { useEffect, useMemo, useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { AppButton } from './Button'
import './premium-calendar.css'

interface PremiumCalendarProps {
  selectedDate: string
  onDateSelect: (date: string) => void
  visibleMonth?: string
  onVisibleMonthChange?: (visibleMonth: string) => void
  todayDate?: string
  showTodayButton?: boolean
  compact?: boolean
  showShell?: boolean
  className?: string
  eventCountByDate?: Readonly<Record<string, number>>
}

const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

function parseMonth(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null
  const [year, month] = value.split('-').map(Number)
  if (month < 1 || month > 12) return null
  return new Date(year, month - 1, 1)
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function PremiumCalendar({
  selectedDate,
  onDateSelect,
  visibleMonth,
  onVisibleMonthChange,
  todayDate,
  showTodayButton = true,
  compact = false,
  showShell = true,
  className,
  eventCountByDate = {},
}: PremiumCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => parseMonth(visibleMonth) ?? startOfMonth(parseDate(selectedDate) ?? new Date()))

  useEffect(() => {
    const parsed = parseMonth(visibleMonth)
    if (parsed) setCurrentMonth(startOfMonth(parsed))
  }, [visibleMonth])

  const today = useMemo(() => todayDate && /^\d{4}-\d{2}-\d{2}$/.test(todayDate) ? todayDate : toDateKey(new Date()), [todayDate])
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const previousMonthDays = new Date(year, month, 0).getDate()
  const previousPadding = Array.from({ length: firstWeekday }, (_, index) => previousMonthDays - firstWeekday + index + 1)
  const currentDays = Array.from({ length: daysInMonth }, (_, index) => index + 1)
  const nextPadding = Array.from({ length: (7 - ((previousPadding.length + currentDays.length) % 7)) % 7 }, (_, index) => index + 1)

  function changeMonth(offset: number) {
    const next = new Date(year, month + offset, 1)
    setCurrentMonth(next)
    onVisibleMonthChange?.(toMonthKey(next))
  }

  function goToday() {
    const parsed = parseDate(today) ?? new Date()
    setCurrentMonth(startOfMonth(parsed))
    onVisibleMonthChange?.(toMonthKey(parsed))
    onDateSelect(today)
  }

  return (
    <section className={['premium-calendar', compact ? 'premium-calendar--compact' : '', showShell ? 'premium-calendar--shell' : '', className ?? ''].filter(Boolean).join(' ')} aria-label="Calendario">
      <header className="premium-calendar__header">
        <div><strong>{MONTHS[month]}</strong><span>{year}</span></div>
        <div className="premium-calendar__navigation">
          {showTodayButton ? <AppButton size="sm" variant="secondary" onClick={goToday}>Hoy</AppButton> : null}
          <AppButton size="sm" variant="ghost" iconOnly leftIcon={<CaretLeft />} aria-label="Mes anterior" onClick={() => changeMonth(-1)} />
          <AppButton size="sm" variant="ghost" iconOnly leftIcon={<CaretRight />} aria-label="Mes siguiente" onClick={() => changeMonth(1)} />
        </div>
      </header>

      <div className="premium-calendar__weekdays">
        {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>

      <div className="premium-calendar__grid">
        {previousPadding.map((day) => <span className="premium-calendar__outside" key={`previous-${day}`}>{day}</span>)}
        {currentDays.map((day) => {
          const date = `${year}-${pad2(month + 1)}-${pad2(day)}`
          const count = eventCountByDate[date] ?? 0
          const selected = date === selectedDate
          return (
            <div className="premium-calendar__cell" key={date}>
              <button type="button" className="premium-calendar__day" aria-label={`Seleccionar día ${day}`} aria-pressed={selected} data-selected={selected} data-today={date === today} onClick={() => onDateSelect(date)}>
                <span>{day}</span>
                {count > 0 ? <i aria-hidden="true" /> : null}
              </button>
            </div>
          )
        })}
        {nextPadding.map((day) => <span className="premium-calendar__outside" key={`next-${day}`}>{day}</span>)}
      </div>
    </section>
  )
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}
