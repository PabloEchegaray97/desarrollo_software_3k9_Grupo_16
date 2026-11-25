import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowsLeftRight,
  CalendarBlank,
  CalendarCheck,
  Clock,
  MagnifyingGlass,
  Phone,
  Plus,
  SpinnerGap,
  Stethoscope,
} from '@phosphor-icons/react'
import type { Chair, Procedure } from '../../catalog/types'
import { Button } from '../../catalog/ui/Button'
import { PatientForm } from '../../patients/PatientForm'
import { patientsApi } from '../../patients/api'
import type { Patient } from '../../patients/types'
import { appointmentsApi } from './api'
import { EXCEPTION_LABELS, toBookingProblem } from './errors'
import { ExceptionModal } from './ExceptionModal'
import { formatLocalRange } from './time'
import type { Appointment, AppointmentInput, BookingField, BookingProblem } from './types'

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
const PATIENT_RESULTS = 5

/** Los errores por campo se muestran junto a cada campo, no como aviso general. */
type ShownProblem = Exclude<BookingProblem, { kind: 'fields' }>

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function AppointmentForm({ options, onCreated, onStepChange }: AppointmentFormProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [patientLoad, setPatientLoad] = useState<PatientLoad>({ status: 'loading' })
  const [procedureId, setProcedureId] = useState('')
  const [chairId, setChairId] = useState(options.chairs.length === 1 ? options.chairs[0]?.id ?? '' : '')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [duracion, setDuracion] = useState('')
  const [intervalo, setIntervalo] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BookingField, string>>>({})
  const [problem, setProblem] = useState<ShownProblem | null>(null)
  const [saving, setSaving] = useState(false)
  const resultsId = useId()

  const procedure = options.procedures.find((item) => item.id === procedureId)
  const chairName = (id: string) => options.chairs.find((item) => item.id === id)?.nombre ?? 'otro sillón'

  useEffect(() => onStepChange?.(step), [onStepChange, step])

  useEffect(() => {
    const controller = new AbortController()
    setPatientLoad({ status: 'loading' })
    patientsApi.list({ ...(submittedQuery ? { q: submittedQuery } : {}), pageSize: PATIENT_RESULTS }, controller.signal).then(
      ({ items }) => {
        if (!controller.signal.aborted) setPatientLoad({ status: 'ready', patients: items })
      },
      () => {
        if (!controller.signal.aborted) setPatientLoad({ status: 'error' })
      },
    )
    return () => controller.abort()
  }, [searchAttempt, submittedQuery])

  function searchPatients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmittedQuery(query.trim())
    setSearchAttempt((value) => value + 1)
  }

  function clearFieldError(field: BookingField) {
    setFieldErrors((errors) => {
      const next = { ...errors }
      delete next[field]
      return next
    })
  }

  function goToDetails() {
    if (!patient) {
      setFieldErrors((errors) => ({ ...errors, pacienteId: 'Elegí un paciente.' }))
      return
    }
    clearFieldError('pacienteId')
    setStep(2)
  }

  function buildInput(): AppointmentInput | null {
    const errors: Partial<Record<BookingField, string>> = {}
    if (!patient) errors.pacienteId = 'Elegí un paciente.'
    if (!procedureId) errors.prestacionId = 'Elegí una prestación.'
    if (!chairId) errors.sillonId = 'Elegí un sillón.'
    if (!fecha) errors.fecha = 'Elegí la fecha.'
    if (!hora) errors.horaInicio = 'Elegí la hora de inicio.'
    if (duracion.trim() !== '' && !WHOLE_NUMBER.test(duracion.trim())) errors.duracionMinutos = 'Ingresá minutos enteros o dejalo vacío.'
    if (intervalo.trim() !== '' && !WHOLE_NUMBER.test(intervalo.trim())) errors.intervaloPosteriorMinutos = 'Ingresá minutos enteros o dejalo vacío.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0 || !patient) return null
    return {
      pacienteId: patient.id,
      prestacionId: procedureId,
      sillonId: chairId,
      fecha,
      horaInicio: hora,
      ...(duracion.trim() !== '' ? { duracionMinutos: Number(duracion) } : {}),
      ...(intervalo.trim() !== '' ? { intervaloPosteriorMinutos: Number(intervalo) } : {}),
    }
  }

  async function send(input: AppointmentInput) {
    if (!patient) return
    setSaving(true)
    try {
      onCreated(await appointmentsApi.create(input), patient)
    } catch (error: unknown) {
      const result = toBookingProblem(error)
      if (result.kind === 'fields') {
        setFieldErrors(result.fields)
        setProblem(null)
      } else {
        setProblem(result)
      }
    } finally {
      setSaving(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProblem(null)
    const input = buildInput()
    if (input) void send(input)
  }

  function confirmException(reason: string) {
    const input = buildInput()
    if (input) void send({ ...input, fueraDisponibilidad: true, motivoExcepcion: reason })
  }

  const updateField = (setter: (value: string) => void, field: BookingField) => (value: string) => {
    setter(value)
    clearFieldError(field)
    setProblem(null)
  }

  return (
    <>
      <div className="apt-wizard" aria-label="Nuevo turno">
        {step === 1 ? (
          <section className="apt-wizard__step" key="patient-step" aria-label="Elegir paciente">
            <form className="apt-wizard__search" onSubmit={searchPatients} role="search">
              <label>
                <MagnifyingGlass size={17} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar paciente por nombre o teléfono..."
                  aria-label="Buscar paciente"
                  aria-controls={resultsId}
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <button type="submit"><MagnifyingGlass size={15} aria-hidden="true" /> Buscar</button>
            </form>

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
                      clearFieldError('pacienteId')
                    }}
                  >
                    <span className="apt-wizard__avatar">{initials(item.nombre)}</span>
                    <span className="apt-wizard__patient-copy">
                      <strong>{item.nombre}</strong>
                      <small><Phone size={13} aria-hidden="true" /> {item.telefono}</small>
                    </span>
                    <i aria-hidden="true" />
                  </button>
                )
              }) : null}
            </div>

            {fieldErrors.pacienteId ? <p className="apt-wizard__error" role="alert">{fieldErrors.pacienteId}</p> : null}
            <Button className="apt-wizard__primary" type="button" variant="primary" size="md" rightIcon={<ArrowRight size={16} />} disabled={!patient} onClick={goToDetails}>
              Continuar
            </Button>
          </section>
        ) : (
          <form className="apt-wizard__step" key="details-step" aria-label="Completar atención" noValidate onSubmit={submit}>
            {problem && problem.kind !== 'outside' ? <ProblemAlert problem={problem} chairName={chairName} /> : null}

            <div className="apt-wizard__selected-patient">
              <div>
                <small>Paciente</small>
                <strong>{patient?.nombre}</strong>
                <span><Phone size={14} aria-hidden="true" /> {patient?.telefono}</span>
              </div>
              <Button type="button" variant="ghost" leftIcon={<ArrowsLeftRight size={16} />} onClick={() => setStep(1)}>
                Cambiar
              </Button>
            </div>

            <label className="apt-wizard__field">
              <span><Stethoscope size={17} aria-hidden="true" /> Prestación</span>
              <select value={procedureId} onChange={(event) => updateField(setProcedureId, 'prestacionId')(event.target.value)} required>
                <option value="">Elegí el servicio</option>
                {options.procedures.map((item) => (
                  <option key={item.id} value={item.id}>{item.nombre} · {item.duracionPredeterminadaMinutos} min</option>
                ))}
              </select>
              {fieldErrors.prestacionId ? <small role="alert">{fieldErrors.prestacionId}</small> : null}
            </label>

            <div className="apt-wizard__field-grid">
              <label className="apt-wizard__field">
                <span>Sillón</span>
                <select value={chairId} onChange={(event) => updateField(setChairId, 'sillonId')(event.target.value)} required>
                  <option value="">Elegí un sillón</option>
                  {options.chairs.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
                {fieldErrors.sillonId ? <small role="alert">{fieldErrors.sillonId}</small> : null}
              </label>

              <label className="apt-wizard__field">
                <span><CalendarBlank size={17} aria-hidden="true" /> Día del turno</span>
                <input type="date" value={fecha} onChange={(event) => updateField(setFecha, 'fecha')(event.target.value)} required />
                {fieldErrors.fecha ? <small role="alert">{fieldErrors.fecha}</small> : null}
              </label>
            </div>

            <label className="apt-wizard__field">
              <span><Clock size={17} aria-hidden="true" /> Horario</span>
              <input type="time" value={hora} onChange={(event) => updateField(setHora, 'horaInicio')(event.target.value)} step={300} required />
              {fieldErrors.horaInicio ? <small role="alert">{fieldErrors.horaInicio}</small> : null}
            </label>

            <details className="apt-wizard__advanced">
              <summary>Ajustes opcionales</summary>
              <div className="apt-wizard__field-grid">
                <label className="apt-wizard__field">
                  <span>Duración (min)</span>
                  <input inputMode="numeric" value={duracion} onChange={(event) => updateField(setDuracion, 'duracionMinutos')(event.target.value)} placeholder={procedure ? `${procedure.duracionPredeterminadaMinutos}` : 'Predeterminada'} />
                  {fieldErrors.duracionMinutos ? <small role="alert">{fieldErrors.duracionMinutos}</small> : null}
                </label>
                <label className="apt-wizard__field">
                  <span>Intervalo posterior (min)</span>
                  <input inputMode="numeric" value={intervalo} onChange={(event) => updateField(setIntervalo, 'intervaloPosteriorMinutos')(event.target.value)} placeholder={`${procedure?.intervaloPosteriorMinutos ?? options.globalIntervalMinutes}`} />
                  {fieldErrors.intervaloPosteriorMinutos ? <small role="alert">{fieldErrors.intervaloPosteriorMinutos}</small> : null}
                </label>
              </div>
            </details>

            <div className="apt-wizard__actions">
              <Button type="button" variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => setStep(1)}>Volver</Button>
              <Button type="submit" variant="primary" leftIcon={<CalendarCheck size={16} />} loading={saving && problem?.kind !== 'outside'} loadingText="Agendando…">
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
            setShowNewPatient(false)
            clearFieldError('pacienteId')
          }}
        />
      ) : null}

      {problem?.kind === 'outside' ? (
        <ExceptionModal
          inicio={problem.inicio}
          finAtencion={problem.finAtencion}
          saving={saving}
          error={fieldErrors.motivoExcepcion}
          onCancel={() => setProblem(null)}
          onConfirm={confirmException}
        />
      ) : null}
    </>
  )
}

function ProblemAlert({ problem, chairName }: { problem: Exclude<ShownProblem, { kind: 'outside' }>; chairName: (id: string) => string }) {
  if (problem.kind === 'conflict') {
    return (
      <div className="adm-alert" data-tone="danger" role="alert">
        <p className="adm-alert__title">{problem.scope === 'SILLON' ? 'El sillón ya está ocupado en ese horario' : 'Ya hay otro turno del odontólogo en ese horario'}</p>
        <p>{problem.scope === 'SILLON' ? 'Elegí otro horario u otro sillón libre.' : 'Hay un solo odontólogo: aunque uses otro sillón, los turnos no pueden superponerse. Elegí otro horario.'}</p>
        {problem.conflicts.length > 0 ? (
          <ul aria-label="Turnos en conflicto">
            {problem.conflicts.map((conflict) => (
              <li key={conflict.turnoId}>{formatLocalRange(conflict.inicio, conflict.finBloqueo)} · {chairName(conflict.sillonId)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }
  if (problem.kind === 'blocked') {
    const label = problem.tipoExcepcion ? (EXCEPTION_LABELS[problem.tipoExcepcion] ?? 'una excepción') : 'una excepción'
    return (
      <div className="adm-alert" data-tone="danger" role="alert">
        <p className="adm-alert__title">Esa fecha está bloqueada por {label}</p>
        <p>{problem.motivoExcepcion ? `Motivo: ${problem.motivoExcepcion}. ` : ''}Para atender ese día, primero cancelá la excepción en Disponibilidad.</p>
      </div>
    )
  }
  return <div className="adm-alert" data-tone="danger" role="alert"><p>{problem.message}</p></div>
}
