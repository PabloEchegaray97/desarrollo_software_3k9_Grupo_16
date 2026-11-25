import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldShellProps {
  id: string
  label: string
  hint?: string
  error?: string
  errorRole?: 'alert'
  optional?: boolean
  required?: boolean
  children: (describedBy: string | undefined) => ReactNode
}

function FieldShell({ id, label, hint, error, errorRole, optional = false, required = false, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="app-field">
      <label className="app-field__label" htmlFor={id}>
        {label}{required ? <span className="app-field__required" aria-hidden="true"> *</span> : null}{optional ? <span className="app-field__optional"> (opcional)</span> : null}
      </label>
      {children(describedBy)}
      {error ? <p className="app-field__error" id={errorId} role={errorRole}>{error}</p> : null}
      {hint ? <p className="app-field__hint" id={hintId}>{hint}</p> : null}
    </div>
  )
}

export interface SelectOption {
  value: string
  label: string
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string
  value: string
  onValueChange: (value: string) => void
  hint?: string
  error?: string
  optional?: boolean
}

export function TextField({ label, value, onValueChange, hint, error, optional = false, id, className, ...props }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} required={props.required}>
      {(describedBy) => (
        <input
          {...props}
          id={fieldId}
          className={['app-control', className].filter(Boolean).join(' ')}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
    </FieldShell>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string
  value: string
  options: readonly SelectOption[]
  placeholder: string
  onValueChange: (value: string) => void
  hint?: string
  error?: string
  optional?: boolean
}

export function SelectField({ label, value, options, placeholder, onValueChange, hint, error, optional, id, className, ...props }: SelectFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional}>
      {(describedBy) => (
        <select
          {...props}
          id={fieldId}
          className={['app-control', className].filter(Boolean).join(' ')}
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

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'ref'> {
  label: string
  value: string
  onValueChange: (value: string) => void
  hint?: string
  error?: string
  errorRole?: 'alert'
  optional?: boolean
  inputRef?: Ref<HTMLTextAreaElement>
}

export function TextAreaField({ label, value, onValueChange, hint, error, errorRole, optional, id, className, inputRef, ...props }: TextAreaFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} errorRole={errorRole} optional={optional}>
      {(describedBy) => (
        <textarea
          {...props}
          ref={inputRef}
          id={fieldId}
          className={['app-control', 'app-control--textarea', className].filter(Boolean).join(' ')}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
    </FieldShell>
  )
}
