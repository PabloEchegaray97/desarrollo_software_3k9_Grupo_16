import { useEffect, useId, useRef, type TextareaHTMLAttributes } from 'react'
import type { Chair } from '../../catalog/types'

export const REASON_MAX_LENGTH = 500

/** Misma normalización acordada para P1-04: recorte y colapso de espacios en blanco. */
export function normalizeReason(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function reasonError(value: string): string | null {
  const normalized = normalizeReason(value)
  if (normalized.length === 0) return 'Ingresá el motivo.'
  if (normalized.length > REASON_MAX_LENGTH) return 'El motivo no puede superar los 500 caracteres.'
  return null
}

/** Etiqueta legible del catálogo; si el sillón ya no se resuelve, se muestra un ID corto. */
export function chairLabel(id: string | null, chairs: readonly Chair[]): string {
  if (!id) return '—'
  return chairs.find((chair) => chair.id === id)?.nombre ?? `${id.slice(0, 8)}…`
}

interface ReasonFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  label: string
  value: string
  error?: string
  onValueChange: (value: string) => void
  hint?: string
}

export function ReasonField({ label, value, error, onValueChange, hint, id, autoFocus, ...props }: ReasonFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!autoFocus) return
    // El `<dialog>` nativo reubica el foco al abrirse;enfocar después de ese efecto.
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [autoFocus])
  const errorId = error ? `${fieldId}-error` : undefined
  const hintId = hint ? `${fieldId}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className="adm-field">
      <label className="adm-field__label" htmlFor={fieldId}>{label}</label>
      <textarea
        {...props}
        ref={inputRef}
        id={fieldId}
        className="adm-input lc-textarea"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? <p className="adm-field__error" id={errorId} role="alert">{error}</p> : null}
      {hint ? <p className="adm-field__hint" id={hintId}>{hint}</p> : null}
    </div>
  )
}
