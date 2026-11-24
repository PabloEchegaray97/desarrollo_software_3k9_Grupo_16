import { Button } from '../../catalog/ui/Button'
import { TERMINAL_STATUSES, type AppointmentStatus, type ChangeableStatus } from './types'

interface StatusActionsProps {
  status: AppointmentStatus
  busy?: boolean
  onReschedule: () => void
  onCancel: () => void
  onChangeStatus: (estado: ChangeableStatus) => void
}

/**
 * Presentación de la matriz de transiciones. No calcula disponibilidad ni decide si ya comenzó el turno:
 * solo evita solicitudes inútiles en estados terminales y en una confirmación repetida.
 */
export function StatusActions({ status, busy = false, onReschedule, onCancel, onChangeStatus }: StatusActionsProps) {
  const terminal = TERMINAL_STATUSES.includes(status)
  const disabled = terminal || busy
  const canConfirm = status === 'PROGRAMADO' && !disabled

  return (
    <section className="lc-actions" aria-labelledby="lc-actions-title">
      <h2 className="lc-section-title" id="lc-actions-title">Acciones del turno</h2>
      <div className="lc-actions__buttons">
        <Button variant="secondary" disabled={disabled} onClick={onReschedule}>Reprogramar turno</Button>
        <Button variant="secondary" disabled={!canConfirm} onClick={() => onChangeStatus('CONFIRMADO')}>Confirmar turno</Button>
        <Button variant="secondary" disabled={disabled} onClick={() => onChangeStatus('ATENDIDO')}>Marcar como atendido</Button>
        <Button variant="secondary" disabled={disabled} onClick={() => onChangeStatus('AUSENTE')}>Registrar ausencia</Button>
        <Button variant="danger" disabled={disabled} onClick={onCancel}>Cancelar turno</Button>
      </div>
      {terminal ? (
        <p className="lc-actions__note" role="note">El turno está en un estado final y no admite nuevas acciones.</p>
      ) : null}
    </section>
  )
}
