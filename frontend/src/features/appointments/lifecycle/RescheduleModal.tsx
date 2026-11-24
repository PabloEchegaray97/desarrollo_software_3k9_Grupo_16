import { useEffect, useState } from 'react'
import { AdminModal } from '../../catalog/ui/AdminModal'
import { Button } from '../../catalog/ui/Button'
import { toLifecycleProblem } from './errors'
import { normalizeReason, ReasonField, reasonError } from './fields'
import { formatLocalRange, toLocalDateTimeInput } from './time'
import type { LifecycleAppointment, LifecycleProblem, RescheduleInput } from './types'

interface RescheduleModalProps {
  open: boolean
  appointment: LifecycleAppointment
  chairs: readonly { id: string; nombre: string }[]
  onClose: () => void
  onSave: (input: RescheduleInput) => Promise<void>
}

export function RescheduleModal({ open, appointment, chairs, onClose, onSave }: RescheduleModalProps) {
  const initial = toLocalDateTimeInput(appointment.inicio)
  const [fecha, setFecha] = useState(initial.fecha)
  const [horaInicio, setHoraInicio] = useState(initial.horaInicio)
  const [sillonId, setSillonId] = useState(appointment.sillonId)
  const [motivo, setMotivo] = useState('')
  const [override, setOverride] = useState(false)
  const [motivoExcepcion, setMotivoExcepcion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [problem, setProblem] = useState<Extract<LifecycleProblem, { kind: 'outside' }> | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const values = toLocalDateTimeInput(appointment.inicio)
    setFecha(values.fecha)
    setHoraInicio(values.horaInicio)
    setSillonId(appointment.sillonId)
    setMotivo('')
    setOverride(false)
    setMotivoExcepcion('')
    setError(null)
    setProblem(null)
    setSaving(false)
  }, [open, appointment.inicio, appointment.sillonId])

  const save = async () => {
    const validation = reasonError(motivo)
    if (validation) {
      setError(validation)
      return
    }
    if (override) {
      const exceptionValidation = reasonError(motivoExcepcion)
      if (exceptionValidation) {
        setError(`Ingresá el motivo de la excepción (1 a 500 caracteres).`)
        return
      }
    }

    const input: RescheduleInput = { fecha, horaInicio, motivo: normalizeReason(motivo) }
    if (sillonId !== appointment.sillonId) input.sillonId = sillonId
    if (override) {
      input.fueraDisponibilidad = true
      input.motivoExcepcion = normalizeReason(motivoExcepcion)
    }

    setError(null)
    setSaving(true)
    try {
      await onSave(input)
      onClose()
    } catch (cause) {
      const mapped = toLifecycleProblem(cause)
      if (mapped.kind === 'outside') {
        setProblem(mapped)
        setOverride(true)
      } else {
        setError(mapped.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminModal
      open={open}
      title="Reprogramar turno"
      description="Elegí la nueva fecha, hora y sillón. El sistema validará la disponibilidad; la interfaz solo muestra el resultado."
      onClose={onClose}
      footer={(
        <>
          <Button onClick={onClose} disabled={saving}>Volver</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {override ? 'Confirmar excepción' : 'Guardar reprogramación'}
          </Button>
        </>
      )}
    >
      <div className="lc-form-grid">
        <div className="adm-field">
          <label className="adm-field__label" htmlFor="lc-fecha">Fecha</label>
          <input className="adm-input" id="lc-fecha" type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
        </div>
        <div className="adm-field">
          <label className="adm-field__label" htmlFor="lc-hora">Hora de inicio</label>
          <input className="adm-input" id="lc-hora" type="time" value={horaInicio} onChange={(event) => setHoraInicio(event.target.value)} />
        </div>
      </div>

      <div className="adm-field">
        <label className="adm-field__label" htmlFor="lc-sillon">Sillón</label>
        <select className="adm-input" id="lc-sillon" value={sillonId} onChange={(event) => setSillonId(event.target.value)}>
          {chairs.map((chair) => <option key={chair.id} value={chair.id}>{chair.nombre}</option>)}
        </select>
      </div>

      <ReasonField
        autoFocus
        label="Motivo de la reprogramación"
        value={motivo}
        onValueChange={setMotivo}
        error={error && !override ? error : undefined}
        hint="Entre 1 y 500 caracteres. Se guarda en el historial."
        rows={4}
        disabled={saving}
      />

      {problem ? (
        <div className="adm-alert" data-tone="warning" role="status">
          <strong className="adm-alert__title">{problem.message}</strong>
          {problem.inicio && problem.finAtencion ? (
            <p>{formatLocalRange(problem.inicio, problem.finAtencion)} en hora del consultorio</p>
          ) : null}
        </div>
      ) : null}

      <label className="adm-check">
        <input
          type="checkbox"
          checked={override}
          onChange={(event) => {
            setOverride(event.target.checked)
            setProblem(null)
            setError(null)
          }}
        />
        Confirmar horario fuera de disponibilidad
      </label>

      {override ? (
        <ReasonField
          label="Motivo de la excepción"
          value={motivoExcepcion}
          onValueChange={setMotivoExcepcion}
          error={error && override ? error : undefined}
          hint="Necesario para confirmar una excepción."
          rows={3}
          disabled={saving}
        />
      ) : null}
    </AdminModal>
  )
}
