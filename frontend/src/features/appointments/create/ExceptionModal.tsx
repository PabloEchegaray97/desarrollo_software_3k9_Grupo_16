import { useState, type FormEvent } from 'react'
import { ArrowLeft, WarningCircle } from '@phosphor-icons/react'
import { AdminModal } from '../../catalog/ui/AdminModal'
import { Button } from '../../catalog/ui/Button'
import { TextAreaField } from './fields'
import { formatLocalDate, formatLocalRange } from './time'

interface ExceptionModalProps {
  inicio: string
  finAtencion: string
  saving: boolean
  error?: string
  onCancel: () => void
  onConfirm: (reason: string) => void
}

export const EXCEPTION_REASON_MAX = 500

/** US-031: el backend informó FUERA_DE_DISPONIBILIDAD; continuar exige un motivo explícito. */
export function ExceptionModal({ inicio, finAtencion, saving, error, onCancel, onConfirm }: ExceptionModalProps) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | undefined>()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = reason.trim()
    if (trimmed === '') {
      setLocalError('Ingresá el motivo de la excepción.')
      return
    }
    setLocalError(undefined)
    onConfirm(trimmed)
  }

  const when = inicio && finAtencion ? `${formatLocalDate(inicio)}, ${formatLocalRange(inicio, finAtencion)}` : 'el horario elegido'

  return (
    <AdminModal
      open
      title="Horario fuera de la disponibilidad"
      description={`No hay atención programada para ${when}. Podés registrarlo igual como excepción justificada.`}
      onClose={onCancel}
      footer={(
        <>
          <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={onCancel}>Volver al formulario</Button>
          <Button variant="highlight" leftIcon={<WarningCircle size={16} />} type="submit" form="exception-form" loading={saving}>Registrar como excepción</Button>
        </>
      )}
    >
      <form id="exception-form" className="adm-page" noValidate onSubmit={submit}>
        <p className="adm-status">La excepción no permite superponer turnos: si el horario choca con otro, se rechaza igual.</p>
        <TextAreaField
          label="Motivo de la excepción"
          value={reason}
          onValueChange={setReason}
          error={localError ?? error}
          hint="Queda registrado en el historial del turno."
          maxLength={EXCEPTION_REASON_MAX}
          required
        />
      </form>
    </AdminModal>
  )
}
