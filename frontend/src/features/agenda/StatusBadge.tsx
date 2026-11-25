import { STATUS_PRESENTATION, type StatusShape } from './status'
import type { AppointmentStatus } from './types'

function Shape({ shape }: { shape: StatusShape }) {
  const common = { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': true, focusable: false } as const
  switch (shape) {
    case 'circle-outline':
      return <svg {...common}><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    case 'circle-check':
      return <svg {...common}><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M4.5 7.2l1.8 1.8 3.2-3.6" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    case 'square-check':
      return <svg {...common}><rect x="1.5" y="1.5" width="11" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M4.5 7.2l1.8 1.8 3.2-3.6" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    case 'triangle-alert':
      return <svg {...common}><path d="M7 1.5L13 12H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 5.5v3M7 10v.5" stroke="currentColor" strokeWidth="1.5" /></svg>
    case 'cross':
      return <svg {...common}><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" /></svg>
  }
}

export function StatusBadge({ estado }: { estado: AppointmentStatus }) {
  const { label, shape } = STATUS_PRESENTATION[estado]
  return (
    <span className="agenda-badge appointment-status-badge" data-status={estado} data-shape={shape}>
      <Shape shape={shape} />
      <span>{label}</span>
    </span>
  )
}
