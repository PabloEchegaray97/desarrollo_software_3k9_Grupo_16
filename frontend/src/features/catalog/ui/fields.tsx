import { useId, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string
  value: string
  onValueChange: (value: string) => void
  hint?: string
  error?: string
  optional?: boolean
}

/** Etiqueta arriba, ayuda y error debajo; el error queda asociado por `aria-describedby`. */
export function TextField({ label, value, onValueChange, hint, error, optional = false, id, ...props }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="adm-field">
      <label className="adm-field__label" htmlFor={inputId}>
        {label} {optional ? <span className="adm-field__optional">(opcional)</span> : null}
      </label>
      <input
        {...props}
        id={inputId}
        className="adm-input"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? <p className="adm-field__error" id={errorId}>{error}</p> : null}
      {hint ? <p className="adm-field__hint" id={hintId}>{hint}</p> : null}
    </div>
  )
}
