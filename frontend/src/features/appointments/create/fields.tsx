import { useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldShellProps {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  children: (describedBy: string | undefined) => ReactNode
}

/** Etiqueta arriba, ayuda y error debajo (design system rev. 1), igual que `TextField` de C-02. */
function FieldShell({ id, label, hint, error, optional = false, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className="adm-field">
      <label className="adm-field__label" htmlFor={id}>
        {label} {optional ? <span className="adm-field__optional">(opcional)</span> : null}
      </label>
      {children(describedBy)}
      {error ? <p className="adm-field__error" id={errorId}>{error}</p> : null}
      {hint ? <p className="adm-field__hint" id={hintId}>{hint}</p> : null}
    </div>
  )
}

export interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string
  value: string
  options: readonly SelectOption[]
  placeholder: string
  onValueChange: (value: string) => void
  hint?: string
  error?: string
}

export function SelectField({ label, value, options, placeholder, onValueChange, hint, error, id, ...props }: SelectFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <select
          {...props}
          id={fieldId}
          className="adm-input"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      )}
    </FieldShell>
  )
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  label: string
  value: string
  onValueChange: (value: string) => void
  hint?: string
  error?: string
}

export function TextAreaField({ label, value, onValueChange, hint, error, id, ...props }: TextAreaFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <textarea
          {...props}
          id={fieldId}
          className="adm-input apt-textarea"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
    </FieldShell>
  )
}
