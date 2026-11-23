import { useState, type FormEvent } from 'react'
import { toFormErrors, type FormErrors } from '../catalog/ui/api-errors'
import { AdminModal } from '../catalog/ui/AdminModal'
import { Button } from '../catalog/ui/Button'
import { TextField } from '../catalog/ui/fields'
import { patientsApi, possibleDuplicateCandidates } from './api'
import { DuplicateWarning } from './DuplicateWarning'
import type { DuplicateCandidate, Patient, PatientInput } from './types'

type Field = 'nombre' | 'telefono' | 'dni' | 'email'

const VALIDATION_MESSAGES: Record<Field, string> = {
  nombre: 'Ingresá un nombre de hasta 120 caracteres.',
  telefono: 'Ingresá un teléfono con 6 a 20 dígitos; se permiten espacios, +, - y paréntesis.',
  dni: 'El DNI debe tener 7 u 8 dígitos; podés escribirlo con puntos.',
  email: 'Ingresá un email válido o dejalo vacío.',
}

interface PatientFormProps {
  patient: Patient | null
  onClose: () => void
  onSaved: (patient: Patient) => void
}

export function PatientForm({ patient, onClose, onSaved }: PatientFormProps) {
  const [nombre, setNombre] = useState(patient?.nombre ?? '')
  const [telefono, setTelefono] = useState(patient?.telefono ?? '')
  const [dni, setDni] = useState(patient?.dni ?? '')
  const [email, setEmail] = useState(patient?.email ?? '')
  const [errors, setErrors] = useState<FormErrors<Field>>({ fields: {} })
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(confirmDuplicate: boolean) {
    const input: PatientInput = {
      nombre,
      telefono,
      dni: dni.trim() === '' ? null : dni,
      email: email.trim() === '' ? null : email,
      ...(confirmDuplicate ? { confirmarPosibleDuplicado: true } : {}),
    }
    setSaving(true)
    setErrors({ fields: {} })
    try {
      onSaved(patient ? await patientsApi.replace(patient.id, input) : await patientsApi.create(input))
    } catch (error: unknown) {
      const candidates = possibleDuplicateCandidates(error)
      if (candidates) {
        setDuplicates(candidates)
      } else {
        setDuplicates(null)
        setErrors(toFormErrors(error, { validation: VALIDATION_MESSAGES, codes: { PATIENT_DNI_CONFLICT: 'dni' } }))
      }
    } finally {
      setSaving(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields: FormErrors<Field>['fields'] = {}
    if (nombre.trim() === '') fields.nombre = 'Ingresá el nombre del paciente.'
    if (telefono.trim() === '') fields.telefono = 'Ingresá un teléfono de contacto.'
    if (Object.keys(fields).length > 0) {
      setErrors({ fields })
      return
    }
    void save(false)
  }

  // Editar nombre o teléfono invalida una advertencia previa.
  const editIdentity = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setDuplicates(null)
  }

  const footer = duplicates ? (
    <>
      <Button variant="ghost" onClick={() => setDuplicates(null)}>Volver a revisar</Button>
      <Button variant="highlight" loading={saving} onClick={() => void save(true)}>Registrar de todos modos</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button variant="primary" type="submit" form="patient-form" loading={saving}>Guardar</Button>
    </>
  )

  return (
    <AdminModal
      open
      title={patient ? 'Editar paciente' : 'Nuevo paciente'}
      description="Solo datos administrativos para asociar turnos."
      onClose={onClose}
      footer={footer}
    >
      <form id="patient-form" className="adm-page" noValidate onSubmit={submit}>
        {duplicates ? <DuplicateWarning candidates={duplicates} /> : null}
        {errors.form ? <div className="adm-alert" data-tone="danger" role="alert"><p>{errors.form}</p></div> : null}
        <TextField label="Nombre y apellido" value={nombre} onValueChange={editIdentity(setNombre)} error={errors.fields.nombre} maxLength={120} autoComplete="off" required />
        <TextField label="Teléfono" type="tel" value={telefono} onValueChange={editIdentity(setTelefono)} error={errors.fields.telefono} hint="Puede compartirse con otro paciente." maxLength={30} autoComplete="off" required />
        <TextField label="DNI" value={dni} onValueChange={setDni} error={errors.fields.dni} hint="7 u 8 dígitos; podés usar puntos." inputMode="numeric" maxLength={12} autoComplete="off" optional />
        <TextField label="Email" type="email" value={email} onValueChange={setEmail} error={errors.fields.email} maxLength={254} autoComplete="off" optional />
      </form>
    </AdminModal>
  )
}
