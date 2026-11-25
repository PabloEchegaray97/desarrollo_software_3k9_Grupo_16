import { ArrowsClockwise, CalendarBlank, Clock, Eye, XCircle } from '@phosphor-icons/react'
import { AppModal } from './AppModal'
import './appointment-action-sheet.css'

interface AppointmentActionSheetProps {
  open: boolean
  patientName: string
  timeRange: string
  serviceName: string
  terminal: boolean
  onClose: () => void
  onDetail: () => void
  onReschedule: () => void
  onCancel: () => void
}

export function AppointmentActionSheet({
  open,
  patientName,
  timeRange,
  serviceName,
  terminal,
  onClose,
  onDetail,
  onReschedule,
  onCancel,
}: AppointmentActionSheetProps) {
  return (
    <AppModal
      open={open}
      className="appointment-action-sheet app-modal--compact-sheet"
      title="Acciones del turno"
      description={patientName}
      closeLabel="Cerrar acciones del turno"
      restoreFocus={false}
      onClose={onClose}
    >
      <div className="appointment-action-sheet__summary">
        <div>
          <Clock size={19} aria-hidden="true" />
          <span>Horario</span>
          <strong>{timeRange}</strong>
        </div>
        <div>
          <CalendarBlank size={19} aria-hidden="true" />
          <span>Turno</span>
          <strong>{serviceName}</strong>
        </div>
      </div>

      <div className="appointment-action-sheet__actions" role="menu" aria-label={`Acciones del turno de ${patientName}`}>
        <button type="button" role="menuitem" className="appointment-action-sheet__detail" onClick={onDetail}>
          <Eye size={21} aria-hidden="true" />
          <span>Ver detalle</span>
        </button>
        <button type="button" role="menuitem" className="appointment-action-sheet__reschedule" disabled={terminal} onClick={onReschedule}>
          <ArrowsClockwise size={21} aria-hidden="true" />
          <span>Reprogramar</span>
        </button>
        <button type="button" role="menuitem" className="appointment-action-sheet__danger" disabled={terminal} onClick={onCancel}>
          <XCircle size={21} aria-hidden="true" />
          <span>Cancelar turno</span>
        </button>
      </div>
    </AppModal>
  )
}
