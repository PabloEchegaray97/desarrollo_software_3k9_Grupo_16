import { useEffect, useRef, useState, type FormEvent } from 'react'
import { cancelException, createException, getExceptions } from '../api'
import type { ExceptionCreateInput, ExceptionKind, ExceptionRecord } from '../types'
import { toFeedback, type Feedback } from './feedback'
import { FeedbackPanel } from './FeedbackPanel'

type Coverage = 'completo' | 'parcial'
type FormStatus = 'loading' | 'ready' | 'saving'

interface FormState {
  fecha: string
  tipo: ExceptionKind
  motivo: string
  cobertura: Coverage
  horaInicio: string
  horaFin: string
}

const INITIAL: FormState = { fecha: '', tipo: 'FERIADO', motivo: '', cobertura: 'completo', horaInicio: '', horaFin: '' }

const TIPOS: Array<[ExceptionKind, string]> = [
  ['FERIADO', 'Feriado'],
  ['VACACIONES', 'Vacaciones'],
  ['BLOQUEO', 'Bloqueo'],
]

export function ExceptionsForm() {
  const [records, setRecords] = useState<ExceptionRecord[]>([])
  const [form, setForm] = useState<FormState>(INITIAL)
  const [status, setStatus] = useState<FormStatus>('loading')
  const [confirmation, setConfirmation] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [motivoError, setMotivoError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const motivoField = useRef<HTMLInputElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let active = true
    setStatus('loading')
    setFeedback(null)
    void getExceptions()
      .then((response) => {
        if (!active) return
        setRecords(response.filter((record) => record.activo))
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!active) return
        setFeedback(toFeedback(error, 'reload'))
        setStatus('ready')
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  useEffect(() => {
    if (!feedback) return
    if (feedback.retry === 'reload') retryButton.current?.focus()
    else if (feedback.focusFirstField) motivoField.current?.focus()
  }, [feedback])

  function change<Key extends keyof FormState>(field: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [field]: value }))
    if (field === 'motivo') setMotivoError('')
  }

  function buildInput(): ExceptionCreateInput {
    const input: ExceptionCreateInput = {
      fecha: form.fecha,
      tipo: form.tipo,
      motivo: form.motivo.trim(),
    }
    if (form.cobertura === 'parcial') {
      input.horaInicio = form.horaInicio
      input.horaFin = form.horaFin
    }
    return input
  }

  async function performSave() {
    if (status === 'saving') return
    if (form.motivo.trim().length === 0) {
      setMotivoError('El motivo es obligatorio.')
      motivoField.current?.focus()
      return
    }
    setMotivoError('')
    setFeedback(null)
    setConfirmation('')
    setStatus('saving')
    try {
      const created = await createException(buildInput())
      setRecords((current) => [created, ...current.filter((record) => record.id !== created.id)])
      const rango = created.horaInicio && created.horaFin ? `${created.horaInicio}–${created.horaFin}` : 'día completo'
      setConfirmation(`Excepción guardada: ${created.tipo} ${created.fecha}, ${rango}.`)
      setForm(INITIAL)
      setStatus('ready')
    } catch (error: unknown) {
      setFeedback(toFeedback(error, 'save'))
      setStatus('ready')
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void performSave()
  }

  async function cancel(record: ExceptionRecord) {
    if (status === 'saving') return
    setFeedback(null)
    setConfirmation('')
    setStatus('saving')
    try {
      await cancelException(record.id)
      setRecords((current) => current.filter((item) => item.id !== record.id))
      setConfirmation('Excepción cancelada: quedó registrada como inactiva.')
      setStatus('ready')
    } catch (error: unknown) {
      setFeedback(toFeedback(error, 'reload'))
      setStatus('ready')
    }
  }

  function retry() {
    if (feedback?.retry === 'reload') setReloadKey((current) => current + 1)
    if (feedback?.retry === 'save') void performSave()
  }

  return (
    <section
      className="avail-card"
      aria-labelledby="avail-exceptions-title"
      data-state={status}
      aria-busy={status === 'loading' || status === 'saving'}
    >
      <h2 id="avail-exceptions-title">Excepciones</h2>
      <p className="avail-card__lead">Registrá feriados, vacaciones y bloqueos con fecha local.</p>

      <FeedbackPanel feedback={feedback} confirmation={confirmation} onRetry={retry} retryRef={retryButton} />
      {status === 'loading' || status === 'saving' ? (
        <p className="avail-loading" role="status">{status === 'loading' ? 'Cargando excepciones…' : 'Guardando excepción…'}</p>
      ) : null}

      <ul className="avail-exceptions-list">
        {records.map((record) => (
          <li key={record.id}>
            <strong>{record.tipo} · {record.fecha}</strong>
            <span>{record.motivo}</span>
            <span>{record.horaInicio && record.horaFin ? `${record.horaInicio}–${record.horaFin}` : 'Día completo'}</span>
            <button type="button" aria-label={`Cancelar excepción ${record.motivo}`} disabled={status === 'saving'} onClick={() => void cancel(record)}>Cancelar excepción</button>
          </li>
        ))}
      </ul>
      {records.length === 0 && status !== 'loading' ? <p className="avail-empty-inline">No hay excepciones activas.</p> : null}

      <form onSubmit={submit}>
        <fieldset disabled={status === 'saving'}>
          <legend>Nueva excepción</legend>
          <div className="avail-field">
            <label htmlFor="exc-fecha">Fecha de la excepción</label>
            <input id="exc-fecha" type="date" value={form.fecha} onChange={(event) => change('fecha', event.target.value)} />
          </div>
          <div className="avail-field">
            <label htmlFor="exc-tipo">Tipo de excepción</label>
            <select id="exc-tipo" value={form.tipo} onChange={(event) => change('tipo', event.target.value as ExceptionKind)}>
              {TIPOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="avail-field">
            <label htmlFor="exc-motivo">Motivo de la excepción</label>
            <input
              id="exc-motivo"
              ref={motivoField}
              value={form.motivo}
              aria-invalid={motivoError ? true : undefined}
              aria-describedby={motivoError ? 'exc-motivo-error' : undefined}
              onChange={(event) => change('motivo', event.target.value)}
            />
            {motivoError ? <p className="avail-field__error" id="exc-motivo-error">{motivoError}</p> : null}
          </div>
          <fieldset className="avail-coverage">
            <legend>Cobertura</legend>
            <label><input type="radio" name="cobertura" value="completo" checked={form.cobertura === 'completo'} onChange={() => change('cobertura', 'completo')} /> Día completo</label>
            <label><input type="radio" name="cobertura" value="parcial" checked={form.cobertura === 'parcial'} onChange={() => change('cobertura', 'parcial')} /> Tramo parcial</label>
          </fieldset>
          {form.cobertura === 'parcial' ? (
            <div className="avail-slot">
              <div className="avail-field">
                <label htmlFor="exc-inicio">Inicio del bloqueo</label>
                <input id="exc-inicio" type="time" value={form.horaInicio} onChange={(event) => change('horaInicio', event.target.value)} />
              </div>
              <div className="avail-field">
                <label htmlFor="exc-fin">Fin del bloqueo</label>
                <input id="exc-fin" type="time" value={form.horaFin} onChange={(event) => change('horaFin', event.target.value)} />
              </div>
            </div>
          ) : null}
          <div className="avail-actions">
            <button type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Guardando…' : 'Guardar excepción'}</button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
