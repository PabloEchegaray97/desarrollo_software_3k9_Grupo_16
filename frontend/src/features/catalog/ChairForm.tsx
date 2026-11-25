import { useState, type FormEvent } from 'react'
import { FloppyDisk, X } from '@phosphor-icons/react'
import { chairsApi } from './api'
import type { Chair } from './types'
import { toFormErrors, type FormErrors } from './ui/api-errors'
import { AdminModal } from './ui/AdminModal'
import { Button } from './ui/Button'
import { TextField } from './ui/fields'

interface ChairFormProps {
  chair: Chair | null
  onClose: () => void
  onSaved: (chair: Chair) => void
}

export function ChairForm({ chair, onClose, onSaved }: ChairFormProps) {
  const [nombre, setNombre] = useState(chair?.nombre ?? '')
  const [errors, setErrors] = useState<FormErrors<'nombre'>>({ fields: {} })
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (nombre.trim() === '') {
      setErrors({ fields: { nombre: 'Ingresá el nombre del sillón.' } })
      return
    }
    setSaving(true)
    setErrors({ fields: {} })
    try {
      onSaved(chair ? await chairsApi.replace(chair.id, { nombre }) : await chairsApi.create({ nombre }))
    } catch (error: unknown) {
      setErrors(toFormErrors(error, {
        validation: { nombre: 'Ingresá un nombre de hasta 60 caracteres.' },
        codes: { CHAIR_NAME_CONFLICT: 'nombre' },
      }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminModal
      open
      title={chair ? 'Editar sillón' : 'Nuevo sillón'}
      description="Completá los datos principales del sillón."
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" leftIcon={<X size={16} />} onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="clients-modal__save" variant="primary" leftIcon={<FloppyDisk size={16} />} type="submit" form="chair-form" loading={saving} loadingText="Guardando…">Guardar sillón</Button>
        </>
      )}
      className="clients-patient-modal"
    >
      <form id="chair-form" className="clients-modal-form clients-modal-form--catalog" noValidate onSubmit={(event) => void submit(event)}>
        {errors.form ? <div className="adm-alert" data-tone="danger" role="alert"><p>{errors.form}</p></div> : null}
        <TextField label="Nombre" value={nombre} onValueChange={setNombre} error={errors.fields.nombre} hint="Por ejemplo: Sillón 1." maxLength={60} autoComplete="off" required />
      </form>
    </AdminModal>
  )
}
