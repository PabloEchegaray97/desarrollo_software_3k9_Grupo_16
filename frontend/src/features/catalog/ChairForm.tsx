import { useState, type FormEvent } from 'react'
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
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="chair-form" loading={saving}>Guardar</Button>
        </>
      )}
    >
      <form id="chair-form" className="adm-page" noValidate onSubmit={(event) => void submit(event)}>
        {errors.form ? <div className="adm-alert" data-tone="danger" role="alert"><p>{errors.form}</p></div> : null}
        <TextField label="Nombre" value={nombre} onValueChange={setNombre} error={errors.fields.nombre} hint="Por ejemplo: Sillón 1." maxLength={60} autoComplete="off" required />
      </form>
    </AdminModal>
  )
}
