import { useId, useState, type FormEvent } from 'react'
import { ApiClientError } from '../../shared/api/client'
import { login } from './api'
import type { SessionUser } from './types'
import './auth.css'

interface LoginFormProps {
  onSuccess: (user: SessionUser) => void
}

interface FieldErrors {
  email?: string
  contrasena?: string
}

export const INVALID_CREDENTIALS_TEXT = 'Email o contraseña incorrectos'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!email.trim()) errors.email = 'Ingresá tu email.'
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Ingresá un email válido.'
  if (!password) errors.contrasena = 'Ingresá tu contraseña.'
  return errors
}

function failureMessage(error: unknown): string {
  if (error instanceof ApiClientError && (error.status === 401 || error.status === 400)) return INVALID_CREDENTIALS_TEXT
  return 'No pudimos conectar con el servidor. Intentá nuevamente.'
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const fieldErrors = validate(email, password)
    setErrors(fieldErrors)
    setFormError(null)
    if (fieldErrors.email || fieldErrors.contrasena) return

    setSubmitting(true)
    try {
      const { usuario } = await login(email.trim(), password)
      onSuccess(usuario)
    } catch (error) {
      setFormError(failureMessage(error))
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  const emailId = `${id}-email`
  const passwordId = `${id}-password`

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
      {formError ? <p className="auth-form__alert" role="alert">{formError}</p> : null}

      <div className="auth-field">
        <label className="auth-field__label" htmlFor={emailId}>Email</label>
        <input
          id={emailId}
          className="auth-input"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
        />
        {errors.email ? <p className="auth-field__error" id={`${emailId}-error`}>{errors.email}</p> : null}
      </div>

      <div className="auth-field">
        <label className="auth-field__label" htmlFor={passwordId}>Contraseña</label>
        <input
          id={passwordId}
          className="auth-input"
          type="password"
          name="contrasena"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={errors.contrasena ? true : undefined}
          aria-describedby={errors.contrasena ? `${passwordId}-error` : undefined}
        />
        {errors.contrasena ? <p className="auth-field__error" id={`${passwordId}-error`}>{errors.contrasena}</p> : null}
      </div>

      <button className="auth-submit" type="submit" disabled={submitting}>
        {submitting ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
