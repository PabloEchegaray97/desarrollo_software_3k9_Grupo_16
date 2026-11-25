import { Armchair, CalendarCheck, Clock, Stethoscope, User, X } from '@phosphor-icons/react'
import { AdminModal } from '../../catalog/ui/AdminModal'
import { Button } from '../../catalog/ui/Button'

interface BookingConfirmationModalProps {
  open: boolean
  patientName: string
  procedureName: string
  chairName: string
  date: string
  time: string
  durationMinutes: number
  saving: boolean
  onCancel: () => void
  onConfirm: () => void
}

function formatCivilDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function BookingConfirmationModal({
  open,
  patientName,
  procedureName,
  chairName,
  date,
  time,
  durationMinutes,
  saving,
  onCancel,
  onConfirm,
}: BookingConfirmationModalProps) {
  return (
    <AdminModal
      open={open}
      title="Confirmar turno"
      description="Revisá los datos antes de agendar."
      onClose={onCancel}
      className="appointment-confirmation-modal"
      footer={(
        <>
          <Button variant="ghost" leftIcon={<X size={16} />} disabled={saving} onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" leftIcon={<CalendarCheck size={16} />} loading={saving} loadingText="Agendando…" onClick={onConfirm}>Confirmar turno</Button>
        </>
      )}
    >
      <dl className="apt-confirmation">
        <div><dt><User size={16} />Paciente</dt><dd>{patientName}</dd></div>
        <div><dt><Stethoscope size={16} />Prestación</dt><dd>{procedureName}</dd></div>
        <div><dt><Clock size={16} />Horario</dt><dd>{formatCivilDate(date)} · {time} hs</dd></div>
        <div><dt><Clock size={16} />Duración</dt><dd>{durationMinutes} min</dd></div>
        <div><dt><Armchair size={16} />Sillón</dt><dd>{chairName}</dd></div>
      </dl>
    </AdminModal>
  )
}
