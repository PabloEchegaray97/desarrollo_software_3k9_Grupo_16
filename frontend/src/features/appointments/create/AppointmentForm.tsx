import { useState, type FormEvent } from 'react'
import type { Chair, Procedure } from '../../catalog/types'
import { Button } from '../../catalog/ui/Button'
import { TextField } from '../../catalog/ui/fields'
import type { Patient } from '../../patients/types'
import { appointmentsApi } from './api'
import { EXCEPTION_LABELS, toBookingProblem } from './errors'
import { ExceptionModal } from './ExceptionModal'
import { SelectField } from './fields'
import { PatientPicker } from './PatientPicker'
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
}

const WHOLE_NUMBER = /^\d+$/

/** Los errores por campo se muestran junto a cada campo, no como aviso general. */
type ShownProblem = Exclude<BookingProblem, { kind: 'fields' }>

export function AppointmentForm({ options, onCreated }: AppointmentFormProps) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [procedureId, setProcedureId] = useState('')
  const [chairId, setChairId] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [duracion, setDuracion] = useState('')
  const [intervalo, setIntervalo] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BookingField, string>>>({})
  const [problem, setProblem] = useState<ShownProblem | null>(null)
  const [saving, setSaving] = useState(false)

  const procedure = options.procedures.find((item) => item.id === procedureId)
  const chairName = (id: string) => options.chairs.find((item) => item.id === id)?.nombre ?? 'otro sillón'

  // Solo presenta valores de referencia; los efectivos los calcula y devuelve el backend.
  const durationHint = procedure ? `Si lo dejás vacío se usa la de la prestación: ${procedure.duracionPredeterminadaMinutos} min. Máximo 240.` : 'Elegí una prestación para ver la duración predeterminada.'
  const intervalHint = procedure
    ? procedure.intervaloPosteriorMinutos === null
      ? `Si lo dejás vacío se usa el intervalo global: ${options.globalIntervalMinutes} min. Máximo 30.`
      : `Si lo dejás vacío se usa el de la prestación: ${procedure.intervaloPosteriorMinutos} min. Máximo 30.`
    : `Intervalo global vigente: ${options.globalIntervalMinutes} min.`

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

  const clearProblem = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setProblem(null)
  }

  return (
    <>
    <form className="apt-form" noValidate onSubmit={submit} aria-label="Nuevo turno">
      {problem && problem.kind !== 'outside' ? <ProblemAlert problem={problem} chairName={chairName} /> : null}

      <fieldset className="apt-section">
        <legend className="apt-section__title">Paciente y atención</legend>
        <PatientPicker selected={patient} onSelect={clearProblem(setPatient)} error={fieldErrors.pacienteId} />
        <div className="apt-grid">
          <SelectField
            label="Prestación"
            value={procedureId}
            onValueChange={clearProblem(setProcedureId)}
            placeholder="Elegí una prestación"
            options={options.procedures.map((item) => ({ value: item.id, label: `${item.nombre} (${item.duracionPredeterminadaMinutos} min)` }))}
            error={fieldErrors.prestacionId}
            required
          />
          <SelectField
            label="Sillón"
            value={chairId}
            onValueChange={clearProblem(setChairId)}
            placeholder="Elegí un sillón"
            options={options.chairs.map((item) => ({ value: item.id, label: item.nombre }))}
            error={fieldErrors.sillonId}
            required
          />
        </div>
      </fieldset>

      <fieldset className="apt-section">
        <legend className="apt-section__title">Fecha y hora (hora de Argentina)</legend>
        <div className="apt-grid">
          <TextField label="Fecha" type="date" value={fecha} onValueChange={clearProblem(setFecha)} error={fieldErrors.fecha} required />
          <TextField label="Hora de inicio" type="time" value={hora} onValueChange={clearProblem(setHora)} error={fieldErrors.horaInicio} step={300} required />
        </div>
      </fieldset>

      <fieldset className="apt-section">
        <legend className="apt-section__title">Ajustes opcionales</legend>
        <div className="apt-grid">
          <TextField label="Duración (minutos)" value={duracion} onValueChange={clearProblem(setDuracion)} hint={durationHint} error={fieldErrors.duracionMinutos} inputMode="numeric" optional />
          <TextField label="Intervalo posterior (minutos)" value={intervalo} onValueChange={clearProblem(setIntervalo)} hint={intervalHint} error={fieldErrors.intervaloPosteriorMinutos} inputMode="numeric" optional />
        </div>
      </fieldset>

      <div className="apt-actions">
        <Button variant="primary" type="submit" loading={saving && problem?.kind !== 'outside'}>Registrar turno</Button>
      </div>
    </form>

      {/* Fuera del <form> del turno: el modal tiene su propio formulario y no se anidan. */}
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
