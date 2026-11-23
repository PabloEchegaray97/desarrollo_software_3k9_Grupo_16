import type { RefObject } from 'react'
import type { Feedback } from './feedback'

interface FeedbackPanelProps {
  feedback: Feedback | null
  confirmation: string
  onRetry: () => void
  retryRef?: RefObject<HTMLButtonElement | null>
}

/** Errores y confirmaciones comparten el mismo contrato visual y accesible. */
export function FeedbackPanel({ feedback, confirmation, onRetry, retryRef }: FeedbackPanelProps) {
  return (
    <>
      {feedback ? (
        <div className="avail-alert" role="alert" data-tone="error">
          <span>{feedback.message}</span>
          {feedback.retryable ? <button type="button" ref={retryRef} data-action="retry" onClick={onRetry}>Reintentar</button> : null}
        </div>
      ) : null}
      {confirmation ? <p className="avail-status" role="status" data-tone="success">{confirmation}</p> : null}
    </>
  )
}
