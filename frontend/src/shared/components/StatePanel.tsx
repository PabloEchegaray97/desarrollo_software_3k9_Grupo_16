export type StatePanelState = 'loading' | 'empty' | 'error'

interface StatePanelProps {
  state: StatePanelState
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function StatePanel({ state, title, description, actionLabel, onAction }: StatePanelProps) {
  return (
    <section className="state-card" data-tone={state === 'error' ? 'error' : 'neutral'} aria-live="polite" aria-busy={state === 'loading'}>
      <strong className="state-card__title">{title}</strong>
      <p className="state-card__body">{description}</p>
      {actionLabel && onAction ? <button className="state-card__action" type="button" onClick={onAction} disabled={state === 'loading'}>{actionLabel}</button> : null}
    </section>
  )
}
