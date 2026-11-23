import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getWeeklySchedule, saveWeeklySchedule } from '../api'
import type { WeeklySlot } from '../types'
import { toFeedback, type Feedback } from './feedback'
import { FeedbackPanel } from './FeedbackPanel'

interface EditableSlot {
  key: string
  diaSemana: string
  horaInicio: string
  horaFin: string
}

type FormStatus = 'loading' | 'empty' | 'ready' | 'saving'

const DIAS = [
  ['1', 'Lunes'],
  ['2', 'Martes'],
  ['3', 'Miércoles'],
  ['4', 'Jueves'],
  ['5', 'Viernes'],
  ['6', 'Sábado'],
  ['7', 'Domingo'],
] as const

const toEditable = (slot: WeeklySlot, key: string): EditableSlot => ({
  key,
  diaSemana: String(slot.diaSemana),
  horaInicio: slot.horaInicio,
  horaFin: slot.horaFin,
})

export function WeeklyScheduleForm() {
  const [slots, setSlots] = useState<EditableSlot[]>([])
  const [version, setVersion] = useState('')
  const [status, setStatus] = useState<FormStatus>('loading')
  const [confirmation, setConfirmation] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const nextKey = useRef(0)
  const firstField = useRef<HTMLSelectElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let active = true
    setStatus('loading')
    setFeedback(null)
    void getWeeklySchedule()
      .then((response) => {
        if (!active) return
        setSlots(response.tramos.map((slot, index) => toEditable(slot, `cargado-${index}`)))
        setVersion(response.version)
        setStatus(response.tramos.length > 0 ? 'ready' : 'empty')
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
    if (feedback.retry === 'reload') {
      retryButton.current?.focus()
      return
    }
    if (!feedback.focusFirstField) return
    if (firstField.current) firstField.current.focus()
    else addButton.current?.focus()
  }, [feedback])

  function addSlot() {
    nextKey.current += 1
    setSlots((current) => [...current, { key: `nuevo-${nextKey.current}`, diaSemana: '', horaInicio: '', horaFin: '' }])
    setStatus('ready')
    setConfirmation('')
  }

  async function performSave() {
    if (status === 'saving') return
    setFeedback(null)
    setConfirmation('')
    setStatus('saving')
    try {
      const response = await saveWeeklySchedule({
        version,
        tramos: slots.map((slot) => ({
          diaSemana: Number(slot.diaSemana),
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
        })),
      })
      setSlots(response.tramos.map((slot, index) => toEditable(slot, `guardado-${index}`)))
      setVersion(response.version)
      setConfirmation('Horarios guardados correctamente.')
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

  function retry() {
    if (feedback?.retry === 'reload') setReloadKey((current) => current + 1)
    if (feedback?.retry === 'save') void performSave()
  }

  function changeSlot(key: string, field: 'diaSemana' | 'horaInicio' | 'horaFin', value: string) {
    setSlots((current) => current.map((slot) => (slot.key === key ? { ...slot, [field]: value } : slot)))
  }

  return (
    <section
      className="avail-card"
      aria-labelledby="avail-weekly-title"
      data-state={status}
      aria-busy={status === 'loading' || status === 'saving'}
    >
      <h2 id="avail-weekly-title">Horarios semanales</h2>
      <p className="avail-card__lead">Definí los tramos en los que se atiende. El backend valida el conjunto completo.</p>

      <FeedbackPanel feedback={feedback} confirmation={confirmation} onRetry={retry} retryRef={retryButton} />
      {status === 'loading' || status === 'saving' ? (
        <p className="avail-loading" role="status">{status === 'loading' ? 'Cargando horarios…' : 'Guardando horarios…'}</p>
      ) : null}

      {status === 'empty' ? (
        <div className="avail-empty" data-state="empty">
          <strong>Todavía no hay tramos definidos</strong>
          <p>Agregá el primer tramo para publicar horarios de atención.</p>
          <button type="button" ref={addButton} onClick={addSlot}>Agregar primer tramo</button>
        </div>
      ) : null}

      <form onSubmit={submit}>
        <fieldset disabled={status === 'saving'}>
          <legend>Tramos de atención</legend>
          {slots.map((slot, index) => (
            <div className="avail-slot" key={slot.key}>
              <div className="avail-field">
                <label htmlFor={`dia-${slot.key}`}>Día del tramo</label>
                <select
                  id={`dia-${slot.key}`}
                  value={slot.diaSemana}
                  ref={index === 0 ? firstField : undefined}
                  onChange={(event) => changeSlot(slot.key, 'diaSemana', event.target.value)}
                >
                  <option value="">Seleccionar día</option>
                  {DIAS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="avail-field">
                <label htmlFor={`inicio-${slot.key}`}>Inicio del tramo</label>
                <input id={`inicio-${slot.key}`} type="time" value={slot.horaInicio} onChange={(event) => changeSlot(slot.key, 'horaInicio', event.target.value)} />
              </div>
              <div className="avail-field">
                <label htmlFor={`fin-${slot.key}`}>Fin del tramo</label>
                <input id={`fin-${slot.key}`} type="time" value={slot.horaFin} onChange={(event) => changeSlot(slot.key, 'horaFin', event.target.value)} />
              </div>
              <button type="button" className="avail-remove" aria-label={`Quitar tramo ${index + 1}`} onClick={() => setSlots((current) => current.filter((item) => item.key !== slot.key))}>Quitar</button>
            </div>
          ))}
          <div className="avail-actions">
            <button type="button" onClick={addSlot}>Agregar tramo</button>
            <button type="submit" disabled={status === 'saving' || slots.length === 0}>{status === 'saving' ? 'Guardando…' : 'Guardar horarios'}</button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
