import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, Clock, FloppyDisk, Plus, Trash } from '@phosphor-icons/react'
import {
  getAvailabilityConfiguration,
  getWeeklySchedule,
  saveAvailabilityConfiguration,
  saveWeeklySchedule,
} from '../api'
import type { AvailabilityConfiguration, WeeklySlot } from '../types'
import { toFeedback, type Feedback } from './feedback'
import { FeedbackPanel } from './FeedbackPanel'

interface EditableSlot {
  key: string
  diaSemana: string
  horaInicio: string
  horaFin: string
}

type FormStatus = 'loading' | 'error' | 'ready' | 'saving'

const FORM_ID = 'availability-settings-form'
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

const INTERVAL_OPTIONS = Array.from({ length: 31 }, (_, minutes) => minutes)

function addMinutes(value: string, amount: number): string {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return ''
  const total = Math.min((hours * 60) + minutes + amount, (24 * 60) - 1)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function daySummary(daySlots: EditableSlot[]): string {
  if (daySlots.length === 0) return 'Cerrado'
  const ranges = daySlots.map((slot) => `${slot.horaInicio || '--:--'} - ${slot.horaFin || '--:--'}`)
  return `Abierto de ${ranges.join(' y ')}`
}

function scheduleSignature(slots: readonly EditableSlot[]): string {
  return [...slots]
    .map((slot) => `${slot.diaSemana}:${slot.horaInicio}-${slot.horaFin}`)
    .sort()
    .join('|')
}

export function AvailabilitySettingsForm() {
  const [slots, setSlots] = useState<EditableSlot[]>([])
  const [configuration, setConfiguration] = useState<AvailabilityConfiguration | null>(null)
  const [version, setVersion] = useState('')
  const [status, setStatus] = useState<FormStatus>('loading')
  const [confirmation, setConfirmation] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [savedSlotsSignature, setSavedSlotsSignature] = useState('')
  const [savedInterval, setSavedInterval] = useState<number | null>(null)
  const nextKey = useRef(0)
  const formRef = useRef<HTMLFormElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setStatus('loading')
    setFeedback(null)
    void Promise.all([
      getWeeklySchedule(controller.signal),
      getAvailabilityConfiguration(controller.signal),
    ]).then(
      ([schedule, agendaConfiguration]) => {
        if (!active) return
        const loadedSlots = schedule.tramos.map((slot, index) => toEditable(slot, `cargado-${index}`))
        setSlots(loadedSlots)
        setVersion(schedule.version)
        setConfiguration(agendaConfiguration)
        setSavedSlotsSignature(scheduleSignature(loadedSlots))
        setSavedInterval(agendaConfiguration.intervaloGlobalMinutos)
        setStatus('ready')
      },
      (error: unknown) => {
        if (!active || controller.signal.aborted) return
        setFeedback(toFeedback(error, 'reload'))
        setStatus('error')
      },
    )
    return () => {
      active = false
      controller.abort()
    }
  }, [reloadKey])

  useEffect(() => {
    if (!feedback) return
    if (feedback.retry === 'reload') retryButton.current?.focus()
    else if (feedback.focusFirstField) {
      formRef.current
        ?.querySelector<HTMLElement>('input[type="time"]:not(:disabled), select:not(:disabled)')
        ?.focus()
    }
  }, [feedback])

  const hasChanges = useMemo(() => (
    configuration !== null && (
      scheduleSignature(slots) !== savedSlotsSignature ||
      configuration.intervaloGlobalMinutos !== savedInterval
    )
  ), [configuration, savedInterval, savedSlotsSignature, slots])

  function clearFeedback() {
    setFeedback(null)
    setConfirmation('')
  }

  function setDayEnabled(day: string, enabled: boolean) {
    clearFeedback()
    setSlots((current) => {
      const currentDaySlots = current.filter((slot) => slot.diaSemana === day)
      if (!enabled) return current.filter((slot) => slot.diaSemana !== day)
      if (currentDaySlots.length > 0) return current

      nextKey.current += 1
      return [...current, {
        key: `nuevo-${nextKey.current}`,
        diaSemana: day,
        horaInicio: '09:00',
        horaFin: '17:00',
      }]
    })
  }

  function addSlot(day: string) {
    clearFeedback()
    nextKey.current += 1
    setSlots((current) => {
      const daySlots = current.filter((slot) => slot.diaSemana === day)
      const previousEnd = daySlots[daySlots.length - 1]?.horaFin || '09:00'
      return [...current, {
        key: `nuevo-${nextKey.current}`,
        diaSemana: day,
        horaInicio: previousEnd,
        horaFin: addMinutes(previousEnd, 60),
      }]
    })
  }

  function removeSlot(key: string) {
    clearFeedback()
    setSlots((current) => current.filter((item) => item.key !== key))
  }

  function changeSlot(key: string, field: 'horaInicio' | 'horaFin', value: string) {
    clearFeedback()
    setSlots((current) => current.map((slot) => (slot.key === key ? { ...slot, [field]: value } : slot)))
  }

  async function performSave() {
    if (status !== 'ready' || !configuration) return
    clearFeedback()
    setStatus('saving')

    const [scheduleResult, configurationResult] = await Promise.allSettled([
      saveWeeklySchedule({
        version,
        tramos: slots.map((slot) => ({
          diaSemana: Number(slot.diaSemana),
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
        })),
      }),
      saveAvailabilityConfiguration(configuration.intervaloGlobalMinutos),
    ])

    const scheduleSaved = scheduleResult.status === 'fulfilled'
    const configurationSaved = configurationResult.status === 'fulfilled'
    if (scheduleSaved) {
      const savedSlots = scheduleResult.value.tramos.map((slot, index) => toEditable(slot, `guardado-${index}`))
      setSlots(savedSlots)
      setVersion(scheduleResult.value.version)
      setSavedSlotsSignature(scheduleSignature(savedSlots))
    }
    if (configurationSaved) {
      setConfiguration(configurationResult.value)
      setSavedInterval(configurationResult.value.intervaloGlobalMinutos)
    }

    const failures = [scheduleResult, configurationResult].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    if (failures.length > 0) {
      const firstFailure = toFeedback(failures[0].reason, 'save')
      const partialMessage = scheduleSaved
        ? 'Se guardó el horario, pero no el intervalo entre turnos.'
        : configurationSaved
          ? 'Se guardó el intervalo, pero no el horario.'
          : 'No se pudieron guardar los cambios.'
      setFeedback({ ...firstFailure, message: `${partialMessage} ${firstFailure.message}` })
      setStatus('ready')
      return
    }

    setConfirmation('Cambios guardados correctamente.')
    setStatus('ready')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void performSave()
  }

  function retry() {
    if (feedback?.retry === 'reload') setReloadKey((current) => current + 1)
    if (feedback?.retry === 'save') void performSave()
  }

  return (
    <>
      <header className="avail-page__header">
        <div>
          <h1 className="page-heading" id="avail-title">Disponibilidad</h1>
          <p className="page-lead">Configurá el horario de atención general y el intervalo entre turnos.</p>
        </div>
        <button
          className="avail-save"
          type="submit"
          form={FORM_ID}
          disabled={status !== 'ready' || !hasChanges}
        >
          {confirmation ? <Check size={17} weight="bold" aria-hidden="true" /> : <FloppyDisk size={17} aria-hidden="true" />}
          {status === 'saving' ? 'Guardando…' : confirmation ? 'Guardado' : 'Guardar cambios'}
        </button>
      </header>

      <section
        className="avail-settings-card"
        aria-labelledby="avail-weekly-title"
        data-state={status}
        aria-busy={status === 'loading' || status === 'saving'}
      >
        <div className="avail-settings-card__content">
          <h2 id="avail-weekly-title">Horario de atención</h2>
          <p className="avail-card__lead">Definí los horarios en los que el consultorio estará abierto.</p>

          <FeedbackPanel feedback={feedback} confirmation={confirmation} onRetry={retry} retryRef={retryButton} />
          {status === 'loading' ? <p className="avail-loading" role="status">Cargando disponibilidad…</p> : null}
          {status === 'saving' ? <p className="avail-loading" role="status">Guardando cambios…</p> : null}

          <form id={FORM_ID} ref={formRef} onSubmit={submit} className="avail-settings-form">
            <fieldset className="avail-day-list" disabled={status !== 'ready'}>
              <legend className="avail-visually-hidden">Días y tramos de atención</legend>
              {DIAS.map(([day, label]) => {
                const daySlots = slots.filter((slot) => slot.diaSemana === day)
                const enabled = daySlots.length > 0
                return (
                  <div className="avail-day" key={day} data-enabled={enabled}>
                    <label className="avail-day__switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={`Abrir ${label.toLowerCase()}`}
                        checked={enabled}
                        onChange={(event) => setDayEnabled(day, event.target.checked)}
                      />
                      <span className="avail-day__switch-track" aria-hidden="true" />
                    </label>
                    <div className="avail-day__content">
                      <div className="avail-day__heading">
                        <strong>{label}</strong>
                        <span>{daySummary(daySlots)}</span>
                      </div>
                      <div className="avail-day__slots-shell" data-open={enabled}>
                        <div className="avail-day__slots-clip">
                          <div className="avail-day__slots">
                          {daySlots.map((slot, index) => (
                            <div className="avail-time-row" key={slot.key}>
                              <Clock size={14} aria-hidden="true" />
                              <label className="avail-visually-hidden" htmlFor={`start-${slot.key}`}>
                                Inicio {label.toLowerCase()}, tramo {index + 1}
                              </label>
                              <input
                                id={`start-${slot.key}`}
                                className="app-control"
                                type="time"
                                value={slot.horaInicio}
                                required
                                onChange={(event) => changeSlot(slot.key, 'horaInicio', event.target.value)}
                              />
                              <span aria-hidden="true">→</span>
                              <label className="avail-visually-hidden" htmlFor={`end-${slot.key}`}>
                                Fin {label.toLowerCase()}, tramo {index + 1}
                              </label>
                              <input
                                id={`end-${slot.key}`}
                                className="app-control"
                                type="time"
                                value={slot.horaFin}
                                required
                                onChange={(event) => changeSlot(slot.key, 'horaFin', event.target.value)}
                              />
                              <button type="button" className="avail-remove" aria-label={`Quitar tramo ${index + 1} del ${label.toLowerCase()}`} onClick={() => removeSlot(slot.key)}>
                                <Trash size={15} aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                          <button type="button" className="avail-add-slot" aria-label="Agregar otro tramo" title={`Agregar otro tramo al ${label.toLowerCase()}`} onClick={() => addSlot(day)}>
                            <Plus size={17} aria-hidden="true" />
                          </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </fieldset>

            <section className="avail-settings-card__footer" aria-labelledby="avail-interval-title">
              <div>
                <h2 id="avail-interval-title">Intervalo entre turnos</h2>
                <p className="avail-card__lead">
                  Intervalo general de preparación, usado cuando una prestación no define uno propio.
                </p>
              </div>
              <div className="app-field avail-field avail-interval">
                <label className="app-field__label" htmlFor="global-interval">Intervalo general</label>
                <span className="avail-interval__control">
                  <Clock size={16} aria-hidden="true" />
                  <select
                    id="global-interval"
                    value={configuration?.intervaloGlobalMinutos ?? ''}
                    disabled={status !== 'ready'}
                    onChange={(event) => {
                      if (!configuration) return
                      clearFeedback()
                      setConfiguration({ ...configuration, intervaloGlobalMinutos: Number(event.target.value) })
                    }}
                  >
                    {INTERVAL_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes === 0 ? 'Sin intervalo' : `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
            </section>
          </form>
        </div>
      </section>
    </>
  )
}
