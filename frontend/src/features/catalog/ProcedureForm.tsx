import { useState, type FormEvent } from 'react'
import { FloppyDisk, X } from '@phosphor-icons/react'
import { proceduresApi } from './api'
import type { Procedure, ProcedureInput } from './types'
import { toFormErrors, type FormErrors } from './ui/api-errors'
import { AdminModal } from './ui/AdminModal'
import { Button } from './ui/Button'
import { TextField } from './ui/fields'

type Field = 'nombre' | 'duracionPredeterminadaMinutos' | 'intervaloPosteriorMinutos'

const VALIDATION_MESSAGES: Record<Field, string> = {
  nombre: 'Ingresá un nombre de hasta 120 caracteres.',
  duracionPredeterminadaMinutos: 'La duración debe ser un número entero entre 1 y 240 minutos.',
  intervaloPosteriorMinutos: 'El intervalo debe ser un número entero entre 0 y 30 minutos, o quedar vacío.',
}

interface ProcedureFormProps {
  procedure: Procedure | null
  onClose: () => void
  onSaved: (procedure: Procedure) => void
}

const WHOLE_NUMBER = /^\d+$/

export function ProcedureForm({ procedure, onClose, onSaved }: ProcedureFormProps) {
  const [nombre, setNombre] = useState(procedure?.nombre ?? '')
  const [duracion, setDuracion] = useState(procedure ? String(procedure.duracionPredeterminadaMinutos) : '')
  const [intervalo, setIntervalo] = useState(procedure?.intervaloPosteriorMinutos === null || !procedure ? '' : String(procedure.intervaloPosteriorMinutos))
  const [errors, setErrors] = useState<FormErrors<Field>>({ fields: {} })
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Solo presencia y tipo: los rangos los valida el backend, que es la autoridad.
    const fields: FormErrors<Field>['fields'] = {}
    if (nombre.trim() === '') fields.nombre = 'Ingresá el nombre de la prestación.'
    if (!WHOLE_NUMBER.test(duracion.trim())) fields.duracionPredeterminadaMinutos = 'Ingresá la duración en minutos enteros.'
    if (intervalo.trim() !== '' && !WHOLE_NUMBER.test(intervalo.trim())) fields.intervaloPosteriorMinutos = 'Ingresá minutos enteros o dejalo vacío.'
    if (Object.keys(fields).length > 0) {
      setErrors({ fields })
      return
    }

    const input: ProcedureInput = {
      nombre,
      duracionPredeterminadaMinutos: Number(duracion),
      intervaloPosteriorMinutos: intervalo.trim() === '' ? null : Number(intervalo),
    }
    setSaving(true)
    setErrors({ fields: {} })
    try {
      onSaved(procedure ? await proceduresApi.replace(procedure.id, input) : await proceduresApi.create(input))
    } catch (error: unknown) {
      setErrors(toFormErrors(error, { validation: VALIDATION_MESSAGES, codes: { PROCEDURE_NAME_CONFLICT: 'nombre' } }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminModal
      open
      title={procedure ? 'Editar prestación' : 'Nueva prestación'}
      description="Completá los datos principales de la prestación."
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" leftIcon={<X size={16} />} onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="clients-modal__save" variant="primary" leftIcon={<FloppyDisk size={16} />} type="submit" form="procedure-form" loading={saving} loadingText="Guardando…">Guardar prestación</Button>
        </>
      )}
      className="clients-patient-modal"
    >
      <form id="procedure-form" className="clients-modal-form clients-modal-form--catalog" noValidate onSubmit={(event) => void submit(event)}>
        {errors.form ? <div className="adm-alert" data-tone="danger" role="alert"><p>{errors.form}</p></div> : null}
        <TextField label="Nombre" value={nombre} onValueChange={setNombre} error={errors.fields.nombre} maxLength={120} autoComplete="off" required />
        <TextField
          label="Duración predeterminada (minutos)"
          value={duracion}
          onValueChange={setDuracion}
          error={errors.fields.duracionPredeterminadaMinutos}
          hint="Entre 1 y 240 minutos."
          inputMode="numeric"
          required
        />
        <TextField
          label="Intervalo posterior (minutos)"
          value={intervalo}
          onValueChange={setIntervalo}
          error={errors.fields.intervaloPosteriorMinutos}
          hint="Entre 0 y 30. Dejalo vacío para usar el intervalo global."
          inputMode="numeric"
          optional
        />
      </form>
    </AdminModal>
  )
}
