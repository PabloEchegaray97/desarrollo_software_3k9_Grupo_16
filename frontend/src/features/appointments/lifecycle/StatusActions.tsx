import { useEffect, useState } from 'react'
import { CalendarDots, Check, CheckCircle, UserMinus, X } from '@phosphor-icons/react'
import { AppButton } from '../../../shared/components/Button'
import { formatLocalShortDate, formatLocalTime } from './time'
import { TERMINAL_STATUSES, type AppointmentStatus, type ChangeableStatus } from './types'

interface StatusActionsProps {
  status: AppointmentStatus
  /** Inicio del turno (ISO UTC). Si se omite, no se restringen atención ni ausencia. */
  startsAt?: string
  busy?: boolean
  onReschedule: () => void
  onCancel: () => void
  onChangeStatus: (estado: ChangeableStatus) => void
}

/** `setTimeout` admite como máximo ~24,8 días; más allá se vuelve a programar. */
const MAX_TIMEOUT_MS = 2_147_483_647

/**
 * Indica si el turno ya comenzó según el reloj del navegador y se actualiza sola al llegar la hora.
 * Es solo presentación: el backend sigue siendo la autoridad y rechaza con 422 (RN-TU-16).
 */
function useHasStarted(startsAt: string | undefined): boolean {
  const start = startsAt ? Date.parse(startsAt) : Number.NaN
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (Number.isNaN(start) || now >= start) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(start - now + 50, MAX_TIMEOUT_MS))
    return () => clearTimeout(timer)
  }, [start, now])

  return Number.isNaN(start) || now >= start
}

/**
 * Presentación de la matriz de transiciones. No calcula disponibilidad: evita solicitudes que el backend
 * rechazaría con certeza (estados terminales, confirmación repetida, atención o ausencia antes del inicio).
 */
export function StatusActions({ status, startsAt, busy = false, onReschedule, onCancel, onChangeStatus }: StatusActionsProps) {
  const terminal = TERMINAL_STATUSES.includes(status)
  const started = useHasStarted(startsAt)
  const disabled = terminal || busy
  const canConfirm = status === 'PROGRAMADO' && !disabled
  const canRecordOutcome = started && !disabled

  return (
    <section className="lc-actions" aria-labelledby="lc-actions-title">
      <h2 className="lc-section-title" id="lc-actions-title">Acciones del turno</h2>
      <div className="lc-actions__buttons">
        <AppButton variant="secondary" leftIcon={<CalendarDots />} disabled={disabled} onClick={onReschedule}>Reprogramar</AppButton>
        <AppButton variant="secondary" leftIcon={<Check />} disabled={!canConfirm} onClick={() => onChangeStatus('CONFIRMADO')}>Confirmar</AppButton>
        <AppButton
          variant="primary"
          leftIcon={<CheckCircle />}
          disabled={!canRecordOutcome}
          aria-describedby={!terminal && !started ? 'lc-actions-not-started' : undefined}
          onClick={() => onChangeStatus('ATENDIDO')}
        >
          Marcar atendido
        </AppButton>
        <AppButton
          variant="secondary"
          leftIcon={<UserMinus />}
          disabled={!canRecordOutcome}
          aria-describedby={!terminal && !started ? 'lc-actions-not-started' : undefined}
          onClick={() => onChangeStatus('AUSENTE')}
        >
          Registrar ausencia
        </AppButton>
        <AppButton variant="danger" leftIcon={<X />} disabled={disabled} onClick={onCancel}>Cancelar turno</AppButton>
      </div>
      {terminal ? (
        <p className="lc-actions__note" role="note">El turno está en un estado final y no admite nuevas acciones.</p>
      ) : !started && startsAt ? (
        <p className="lc-actions__note" id="lc-actions-not-started" role="note">
          Atención y ausencia se habilitan desde el inicio del turno ({formatLocalShortDate(startsAt)} {formatLocalTime(startsAt)}).
        </p>
      ) : null}
    </section>
  )
}
