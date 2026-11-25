import type { ReactNode } from 'react'

export type StatePanelState = 'loading' | 'empty' | 'error'

interface StatePanelProps {
  state: StatePanelState
  title: string
  description: string
  actionLabel?: string
  actionIcon?: ReactNode
  onAction?: () => void
}

export function StatePanel({ state, title, description, actionLabel, actionIcon, onAction }: StatePanelProps) {
  return (
    <section className="state-card" data-tone={state === 'error' ? 'error' : 'neutral'} aria-live="polite" aria-busy={state === 'loading'}>
      <strong className="state-card__title">{title}</strong>
      <p className="state-card__body">{description}</p>
      {actionLabel && onAction ? (
        <button className="state-card__action" type="button" onClick={onAction} disabled={state === 'loading'}>
          {actionIcon ? <span className="state-card__action-icon" aria-hidden="true">{actionIcon}</span> : null}
          <span>{actionLabel}</span>
        </button>
      ) : null}
    </section>
  )
}
