import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { sileo } from 'sileo'
import {
  ArrowLeft,
  ArrowRight,
  ArrowsLeftRight,
  CalendarCheck,
  Clock,
  MagnifyingGlass,
  Plus,
  SpinnerGap,
  Stethoscope,
} from '@phosphor-icons/react'
import { PremiumCalendar } from '../../../shared/components/PremiumCalendar'
import { agendaApi } from '../../agenda/api'
import type { AgendaDia, AgendaResponse } from '../../agenda/types'
import type { Chair, Procedure } from '../../catalog/types'
import { Button } from '../../catalog/ui/Button'
import { PatientForm } from '../../patients/PatientForm'
import { patientsApi } from '../../patients/api'
import type { Patient } from '../../patients/types'
import { appointmentsApi } from './api'
import { BookingConfirmationModal } from './BookingConfirmationModal'
import { EXCEPTION_LABELS, toBookingProblem } from './errors'
import { ExceptionModal } from './ExceptionModal'
import { computeAvailableSlots, currentClinicDateKey, currentClinicMonthKey, isDayDeclaredAndOpen, monthBounds } from './slots'
import { formatLocalRange } from './time'
import type { Appointment, AppointmentInput, BookingProblem } from './types'

export interface BookingOptions {
  procedures: readonly Procedure[]
  chairs: readonly Chair[]
  globalIntervalMinutes: number
}

interface AppointmentFormProps {
  options: BookingOptions
  onCreated: (appointment: Appointment, patient: Patient) => void
  onStepChange?: (step: number) => void
}

type PatientLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; patients: Patient[] }

const WHOLE_NUMBER = /^\d+$/
const PATIENT_RESULTS = 20

type OutsideProblem = Extract<BookingProblem, { kind: 'outside' }>

type AgendaMonthLoad =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: AgendaResponse }

export function AppointmentForm({ options, onCreated, onStepChange }: AppointmentFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [patientLoad, setPatientLoad] = useState<PatientLoad>({ status: 'loading' })
  const [procedureId, setProcedureId] = useState('')
  const [chairId, setChairId] = useState(options.chairs[0]?.id ?? '')
  const [sobreturno, setSobreturno] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => currentClinicMonthKey())
  const [agendaAttempt, setAgendaAttempt] = useState(0)
  const [agendaLoad, setAgendaLoad] = useState<AgendaMonthLoad>({ status: 'idle' })
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [duracion, setDuracion] = useState('')
  const [intervalo, setIntervalo] = useState('')
  const [outsideProblem, setOutsideProblem] = useState<OutsideProblem | null>(null)
  const [exceptionError, setExceptionError] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState<AppointmentInput | null>(null)
  const resultsId = useId()
  const scheduleDetailsRef = useRef<HTMLDivElement>(null)

  const procedure = options.procedures.find((item) => item.id === procedureId)
  const chairName = (id: string) => options.chairs.find((item) => item.id === id)?.nombre ?? 'otro sillón'

  useEffect(() => onStepChange?.(step), [onStepChange, step])

  useEffect(() => {
    const controller = new AbortController()
    setAgendaLoad({ status: 'loading' })
    agendaApi.get(monthBounds(visibleMonth), controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setAgendaLoad({ status: 'ready', data })
      },
      () => {
        if (!controller.signal.aborted) {
          setAgendaLoad({ status: 'error' })
          sileo.error({ title: 'No se pudo cargar la disponibilidad', description: 'Revisá la conexión e intentá nuevamente.' })
        }
      },
    )
    return () => controller.abort()
  }, [visibleMonth, agendaAttempt])

  const dayMap = useMemo(() => {
    const map = new Map<string, AgendaDia>()
    if (agendaLoad.status !== 'ready') return map
    for (const dia of agendaLoad.data.dias) map.set(dia.fecha, dia)
    return map
  }, [agendaLoad])

  const effectiveDuration = duracion.trim() !== '' && WHOLE_NUMBER.test(duracion.trim())
    ? Number(duracion)
    : (procedure?.duracionPredeterminadaMinutos ?? 30)
  const effectiveInterval = intervalo.trim() !== '' && WHOLE_NUMBER.test(intervalo.trim())
    ? Number(intervalo)
    : (procedure?.intervaloPosteriorMinutos ?? options.globalIntervalMinutes)

  const todayKey = currentClinicDateKey()
  const isSobreturnoToday = sobreturno && fecha === todayKey

  const availableSlots = useMemo(() => {
    if (agendaLoad.status !== 'ready' || !fecha || isSobreturnoToday) return []
    return computeAvailableSlots({
      dia: dayMap.get(fecha),
      turnos: agendaLoad.data.turnos,
      durationMinutes: effectiveDuration,
      postIntervalMinutes: effectiveInterval,
    })
  }, [agendaLoad, dayMap, fecha, effectiveDuration, effectiveInterval, isSobreturnoToday])

  useEffect(() => {
    if (agendaLoad.status !== 'ready' || !fecha) return
    if (sobreturno && fecha === todayKey) return
    if (!isDayDeclaredAndOpen(dayMap.get(fecha))) {
      setFecha('')
      setHora('')
    }
  }, [agendaLoad.status, dayMap, fecha, sobreturno, todayKey])

  useEffect(() => {
    if (isSobreturnoToday) return
    if (hora && availableSlots.length > 0 && !availableSlots.includes(hora)) {
      setHora('')
    }
  }, [availableSlots, hora, isSobreturnoToday])

  useEffect(() => {
    if (step !== 2 || !fecha) return
    scheduleDetailsRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [fecha, step])

  useEffect(() => {
    const controller = new AbortController()
    setPatientLoad({ status: 'loading' })
    patientsApi.list({ ...(submittedQuery ? { q: submittedQuery } : {}), pageSize: PATIENT_RESULTS }, controller.signal).then(
      ({ items }) => {
        if (!controller.signal.aborted) setPatientLoad({ status: 'ready', patients: items })
      },
      () => {
        if (!controller.signal.aborted) {
          setPatientLoad({ status: 'error' })
          sileo.error({ title: 'No se pudieron cargar los pacientes', description: 'Intentá nuevamente en unos segundos.' })
        }
      },
    )
    return () => controller.abort()
  }, [searchAttempt, submittedQuery])

  function notifyMissing(title: string, description: string) {
    sileo.error({ title, description })
  }

  function showProblemToast(problem: Exclude<BookingProblem, { kind: 'outside' }>) {
    if (problem.kind === 'fields') {
      const message = Object.values(problem.fields)[0] ?? 'Revisá los datos ingresados.'
      if (problem.fields.motivoExcepcion) setExceptionError(problem.fields.motivoExcepcion)
      sileo.error({ title: 'Datos inválidos', description: message })
      return
    }
    if (problem.kind === 'conflict') {
      const title = problem.scope === 'SILLON'
        ? 'El sillón ya está ocupado en ese horario'
        : 'Ya hay otro turno del odontólogo en ese horario'
      const firstConflict = problem.conflicts[0]
      const detail = firstConflict
        ? `${formatLocalRange(firstConflict.inicio, firstConflict.finBloqueo)} · ${chairName(firstConflict.sillonId)}`
        : (problem.scope === 'SILLON' ? 'Elegí otro horario u otro sillón libre.' : 'Elegí otro horario.')
      sileo.error({ title, description: detail })
      return
    }
    if (problem.kind === 'blocked') {
      const label = problem.tipoExcepcion ? (EXCEPTION_LABELS[problem.tipoExcepcion] ?? 'una excepción') : 'una excepción'
      const detail = problem.motivoExcepcion
        ? `Motivo: ${problem.motivoExcepcion}.`
        : 'Para atender ese día, primero cancelá la excepción en Disponibilidad.'
      sileo.error({ title: `Fecha bloqueada por ${label}`, description: detail })
      return
    }
    sileo.error({ title: 'No se pudo agendar el turno', description: problem.message })
  }

  function goToScheduleStep() {
    if (!procedureId) {
      notifyMissing('Falta elegir el servicio', 'Seleccioná una prestación para calcular la duración y los horarios.')
      return
    }
    if (!chairId) {
      notifyMissing('Falta elegir el sillón', 'Seleccioná un sillón disponible.')
      return
    }
    if (duracion.trim() !== '' && !WHOLE_NUMBER.test(duracion.trim())) {
      notifyMissing('Duración inválida', 'La duración debe ser un número entero.')
      return
    }
    if (intervalo.trim() !== '' && !WHOLE_NUMBER.test(intervalo.trim())) {
      notifyMissing('Intervalo inválido', 'El intervalo posterior debe ser un número entero.')
      return
    }
    setStep(2)
  }

  function goToPatientStep() {
    if (!fecha) {
      notifyMissing('Falta elegir el día', 'Seleccioná un día habilitado en el calendario.')
      return
    }
    if (!hora) {
      notifyMissing('Falta elegir el horario', 'Seleccioná uno de los horarios disponibles.')
      return
    }
    setStep(3)
  }

  function buildInput(): AppointmentInput | null {
    const errors: string[] = []
    if (!patient) errors.push('Elegí un paciente.')
    if (!procedureId) errors.push('Elegí una prestación.')
    if (!chairId) errors.push('Elegí un sillón.')
    if (!fecha) errors.push('Elegí la fecha.')
    if (!hora) errors.push('Elegí la hora de inicio.')
    if (duracion.trim() !== '' && !WHOLE_NUMBER.test(duracion.trim())) errors.push('La duración debe ser un número entero.')
    if (intervalo.trim() !== '' && !WHOLE_NUMBER.test(intervalo.trim())) errors.push('El intervalo posterior debe ser un número entero.')
    if (errors.length > 0 || !patient) {
      notifyMissing('Faltan datos del turno', errors[0] ?? 'Completá los campos requeridos.')
      return null
    }
    return {
      pacienteId: patient.id,
      prestacionId: procedureId,
      sillonId: chairId,
      fecha,
      horaInicio: hora,
      ...(duracion.trim() !== '' ? { duracionMinutos: Number(duracion) } : {}),
      ...(intervalo.trim() !== '' ? { intervaloPosteriorMinutos: Number(intervalo) } : {}),
      ...(isSobreturnoToday ? { sobreturno: true } : {}),
    }
  }

  async function send(input: AppointmentInput) {
    if (!patient) return
    setConfirmationInput(null)
    setSaving(true)
    setExceptionError(undefined)
    try {
      const appointment = await appointmentsApi.create(input)
      setOutsideProblem(null)
      sileo.success({
        title: 'Turno agendado',
        description: `${patient.nombre} · ${fecha} a las ${hora} hs.`,
      })
      onCreated(appointment, patient)
    } catch (error: unknown) {
      const result = toBookingProblem(error)
      if (result.kind === 'outside') {
        setOutsideProblem(result)
      } else {
        showProblemToast(result)
      }
    } finally {
      setSaving(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = buildInput()
    if (input) setConfirmationInput(input)
  }

  function confirmException(reason: string) {
    const input = buildInput()
    if (input) void send({ ...input, fueraDisponibilidad: true, motivoExcepcion: reason })
  }

  const updateField = (setter: (value: string) => void) => (value: string) => {
    setter(value)
  }

  return (
    <>
      <div className="apt-wizard" aria-label="Nuevo turno">
        {step === 1 ? (
          <section className="apt-wizard__step" key="service-step" aria-label="Elegir servicio y sillón">
            <div className="apt-wizard__content">
            <label className="apt-wizard__field">
              <span><Stethoscope size={17} aria-hidden="true" /> Prestación</span>
              <select value={procedureId} onChange={(event) => updateField(setProcedureId)(event.target.value)} required>
                <option value="">Elegí el servicio</option>
                {options.procedures.map((item) => (
                  <option key={item.id} value={item.id}>{item.nombre} · {item.duracionPredeterminadaMinutos} min</option>
                ))}
              </select>
            </label>

            <label className="apt-wizard__field">
              <span>Sillón</span>
              <select value={chairId} onChange={(event) => updateField(setChairId)(event.target.value)} required>
                <option value="">Elegí un sillón</option>
                {options.chairs.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </label>

            <label className="apt-wizard__switch">
              <input
                type="checkbox"
                checked={sobreturno}
                onChange={(event) => {
                  setSobreturno(event.target.checked)
                  setHora('')
                }}
              />
              <span aria-hidden="true" />
              <div>
                <strong>Sobreturno</strong>
                <small>Anula las restricciones de horario solo para el día de hoy.</small>
              </div>
            </label>

            <details
              className="apt-wizard__advanced"
              onToggle={(event) => {
                if (event.currentTarget.open) event.currentTarget.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
              }}
            >
              <summary>Ajustes opcionales</summary>
              <div className="apt-wizard__field-grid">
                <label className="apt-wizard__field">
                  <span>Duración (min)</span>
                  <input inputMode="numeric" value={duracion} onChange={(event) => updateField(setDuracion)(event.target.value)} placeholder={procedure ? `${procedure.duracionPredeterminadaMinutos}` : 'Predeterminada'} />
                </label>
                <label className="apt-wizard__field">
                  <span>Intervalo posterior (min)</span>
                  <input inputMode="numeric" value={intervalo} onChange={(event) => updateField(setIntervalo)(event.target.value)} placeholder={`${procedure?.intervaloPosteriorMinutos ?? options.globalIntervalMinutes}`} />
                </label>
              </div>
            </details>
            </div>

            <div className="apt-wizard__actions apt-wizard__actions--single">
              <Button className="apt-wizard__primary" type="button" variant="primary" size="md" rightIcon={<ArrowRight size={16} />} onClick={goToScheduleStep}>
                Continuar
              </Button>
            </div>
          </section>
        ) : step === 2 ? (
          <section className="apt-wizard__step" key="schedule-step" aria-label="Elegir día y horario">
            <div className="apt-wizard__content">
            <div className="apt-wizard__selected-patient">
              <div>
                <small>Servicio y sillón</small>
                <strong>{procedure?.nombre ?? 'Servicio'} · {chairName(chairId)}</strong>
                <span>{effectiveDuration} min de atención</span>
              </div>
              <Button type="button" variant="ghost" leftIcon={<ArrowsLeftRight size={16} />} onClick={() => setStep(1)}>
                Cambiar
              </Button>
            </div>

            <div className="apt-wizard__field">
              <div className="apt-wizard__calendar">
                <PremiumCalendar
                  selectedDate={fecha}
                  onDateSelect={(date) => {
                    updateField(setFecha)(date)
                    setHora('')
                  }}
                  visibleMonth={visibleMonth}
                  onVisibleMonthChange={(month) => {
                    setVisibleMonth(month)
                    setFecha('')
                    setHora('')
                  }}
                  compact
                  showShell={false}
                  isDateDisabled={(date) => {
                    if (sobreturno && date === todayKey) return false
                    return agendaLoad.status === 'ready' ? !isDayDeclaredAndOpen(dayMap.get(date)) : false
                  }}
                />
              </div>
            </div>

            {fecha || agendaLoad.status === 'loading' || agendaLoad.status === 'error' ? (
              <div className="apt-wizard__field" ref={scheduleDetailsRef}>
                <span><Clock size={17} aria-hidden="true" /> {isSobreturnoToday ? 'Horario (sobreturno hoy)' : 'Horario disponible'}</span>
                {isSobreturnoToday ? (
                  <>
                    <input
                      type="time"
                      value={hora}
                      onChange={(event) => updateField(setHora)(event.target.value)}
                      onClick={(event) => {
                        try {
                          event.currentTarget.showPicker?.()
                        } catch {
                          // Algunos navegadores bloquean showPicker si no está disponible.
                        }
                      }}
                      required
                    />
                    <span className="apt-wizard__switch-note">Podés cargar cualquier horario para hoy, incluso pasado o superpuesto.</span>
                  </>
                ) : agendaLoad.status === 'loading' ? (
                  <div className="apt-wizard__slots-state"><SpinnerGap size={16} className="apt-wizard__spinner" /> Cargando disponibilidad…</div>
                ) : agendaLoad.status === 'error' ? (
                  <div className="apt-wizard__slots-state">
                    No se pudo cargar la disponibilidad.{' '}
                    <button type="button" onClick={() => setAgendaAttempt((value) => value + 1)}>Reintentar</button>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="apt-wizard__slots-state">No hay horarios disponibles para este día.</div>
                ) : (
                  <div className="apt-wizard__slots" role="group" aria-label="Horarios disponibles">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className="apt-wizard__slot"
                        aria-pressed={hora === slot}
                        onClick={() => updateField(setHora)(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            </div>

            <div className="apt-wizard__actions">
              <Button type="button" variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => setStep(1)}>Volver</Button>
              <Button type="button" variant="primary" rightIcon={<ArrowRight size={16} />} onClick={goToPatientStep}>
                Continuar
              </Button>
            </div>
          </section>
        ) : (
          <form className="apt-wizard__step" key="patient-step" aria-label="Elegir paciente" noValidate onSubmit={submit}>
            <div className="apt-wizard__content">
            <div className="apt-wizard__selected-patient">
              <div>
                <small>{fecha} · {hora} hs</small>
                <strong>{procedure?.nombre ?? 'Servicio'} · {chairName(chairId)}</strong>
                <span>{effectiveDuration} min de atención</span>
              </div>
              <Button type="button" variant="ghost" leftIcon={<ArrowsLeftRight size={16} />} onClick={() => setStep(2)}>
                Cambiar fecha
              </Button>
            </div>

            <div className="apt-wizard__search" role="search">
              <label>
                <MagnifyingGlass size={17} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      setSubmittedQuery(query.trim())
                      setSearchAttempt((value) => value + 1)
                    }
                  }}
                  placeholder="Buscar paciente por nombre o teléfono..."
                  aria-label="Buscar paciente"
                  aria-controls={resultsId}
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setSubmittedQuery(query.trim())
                  setSearchAttempt((value) => value + 1)
                }}
              >
                <MagnifyingGlass size={15} aria-hidden="true" /> Buscar
              </button>
            </div>

            <div className="apt-wizard__patient-toolbar">
              <p>{submittedQuery ? `Resultados para “${submittedQuery}”.` : 'Pacientes recientes.'}</p>
              <Button type="button" variant="ghost" leftIcon={<Plus size={16} />} onClick={() => setShowNewPatient(true)}>
                Nuevo
              </Button>
            </div>

            <div className="apt-wizard__patients" id={resultsId} aria-live="polite" aria-busy={patientLoad.status === 'loading'}>
              {patientLoad.status === 'loading' ? (
                <div className="apt-wizard__patients-state"><SpinnerGap size={18} className="apt-wizard__spinner" /> Buscando pacientes…</div>
              ) : null}
              {patientLoad.status === 'error' ? (
                <div className="apt-wizard__patients-state">
                  No se pudieron cargar. <button type="button" onClick={() => setSearchAttempt((value) => value + 1)}>Reintentar</button>
                </div>
              ) : null}
              {patientLoad.status === 'ready' && patientLoad.patients.length === 0 ? (
                <div className="apt-wizard__patients-state">No encontramos pacientes para esa búsqueda.</div>
              ) : null}
              {patientLoad.status === 'ready' ? patientLoad.patients.map((item) => {
                const selected = patient?.id === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="apt-wizard__patient"
                    aria-pressed={selected}
                    onClick={() => {
                      setPatient(selected ? null : item)
                    }}
                  >
                    <span className="apt-wizard__patient-copy">
                      <strong>{item.nombre}</strong>
                      <small>{item.dni ? `DNI ${item.dni}` : 'Sin DNI'}</small>
                    </span>
                    <i aria-hidden="true" />
                  </button>
                )
              }) : null}
            </div>
            </div>

            <div className="apt-wizard__actions">
              <Button type="button" variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => setStep(2)}>Volver</Button>
              <Button type="submit" variant="primary" leftIcon={<CalendarCheck size={16} />} loading={saving && !outsideProblem} loadingText="Agendando…">
                Agendar turno
              </Button>
            </div>
          </form>
        )}
      </div>

      {showNewPatient ? (
        <PatientForm
          patient={null}
          onClose={() => setShowNewPatient(false)}
          onSaved={(savedPatient) => {
            setPatient(savedPatient)
            setPatientLoad((current) => ({
              status: 'ready',
              patients: [
                savedPatient,
                ...(current.status === 'ready' ? current.patients.filter((item) => item.id !== savedPatient.id) : []),
              ].slice(0, PATIENT_RESULTS),
            }))
            setQuery('')
            setSubmittedQuery('')
            setShowNewPatient(false)
          }}
        />
      ) : null}

      {confirmationInput && patient && procedure ? (
        <BookingConfirmationModal
          open
          patientName={patient.nombre}
          procedureName={procedure.nombre}
          chairName={chairName(chairId)}
          date={fecha}
          time={hora}
          durationMinutes={effectiveDuration}
          saving={saving}
          onCancel={() => setConfirmationInput(null)}
          onConfirm={() => void send(confirmationInput)}
        />
      ) : null}

      {outsideProblem ? (
        <ExceptionModal
          inicio={outsideProblem.inicio}
          finAtencion={outsideProblem.finAtencion}
          saving={saving}
          error={exceptionError}
          onCancel={() => setOutsideProblem(null)}
          onConfirm={confirmException}
        />
      ) : null}
    </>
  )
}
