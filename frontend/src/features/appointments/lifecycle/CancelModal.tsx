import { useEffect, useState } from 'react'
import { AdminModal } from '../../catalog/ui/AdminModal'
import { Button } from '../../catalog/ui/Button'
import { toLifecycleProblem } from './errors'
import { normalizeReason, ReasonField, reasonError } from './fields'

interface CancelModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (motivo: string) => Promise<void>
}

export function CancelModal({ open, onClose, onConfirm }: CancelModalProps) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMotivo('')
    setError(null)
    setSaving(false)
  }, [open])

  const confirm = async () => {
    const validation = reasonError(motivo)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onConfirm(normalizeReason(motivo))
      onClose()
    } catch (cause) {
      setError(toLifecycleProblem(cause).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminModal
      open={open}
      title="Cancelar turno"
      description="El motivo queda en el historial y el horario se libera. El turno no se elimina."
      onClose={onClose}
      footer={(
        <>
          <Button onClick={onClose} disabled={saving}>Volver</Button>
          <Button variant="danger" loading={saving} onClick={() => void confirm()}>Confirmar cancelación</Button>
        </>
      )}
    >
      <ReasonField
        autoFocus
        label="Motivo de la cancelación"
        value={motivo}
        onValueChange={setMotivo}
        error={error ?? undefined}
        hint="Entre 1 y 500 caracteres. Se guarda tal como se confirma."
        rows={4}
        disabled={saving}
      />
    </AdminModal>
  )
}
