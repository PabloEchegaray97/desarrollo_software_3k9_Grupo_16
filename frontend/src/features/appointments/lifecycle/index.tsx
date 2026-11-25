import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { StatePanel } from '../../../shared/components/StatePanel'
import { chairsApi } from '../../catalog/api'
import type { Chair } from '../../catalog/types'
import { AppointmentDetail } from './AppointmentDetail'
import { lifecycleApi } from './api'
import { CancelModal } from './CancelModal'
import { toLifecycleProblem } from './errors'
import './lifecycle.css'
import { RescheduleModal } from './RescheduleModal'
import type {
  ChangeableStatus,
  LifecycleAppointment,
  LifecycleEvent,
  LifecycleResponse,
  RescheduleInput,
} from './types'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; appointment: LifecycleAppointment; eventos: LifecycleEvent[]; chairs: Chair[] }

/** La página solo presenta respuestas del backend: nunca calcula disponibilidad ni ventanas temporales. */
export function AppointmentLifecyclePage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const id = appointmentId ?? ''
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [modal, setModal] = useState<'reschedule' | 'cancel' | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [focusTick, setFocusTick] = useState(0)

  useEffect(() => {
    if (!id) {
      setState({ status: 'error', message: 'Falta el identificador del turno.' })
      return
    }
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })

    const load = async () => {
      try {
        const [detalle, historial, catalogo] = await Promise.all([
          lifecycleApi.getAppointment(id, controller.signal),
          lifecycleApi.getHistory(id, controller.signal),
          chairsApi.list({ pageSize: 100 }, controller.signal),
        ])
        if (!active) return
        setState({
          status: 'ready',
          appointment: detalle.turno,
          eventos: historial.eventos,
          chairs: catalogo.items,
        })
      } catch (cause) {
        if (!active || controller.signal.aborted) return
        setState({ status: 'error', message: toLifecycleProblem(cause).message })
      }
    }

    void load()
    return () => {
      active = false
      controller.abort()
    }
  }, [id, attempt])

  useEffect(() => {
    if (focusTick === 0) return
    document.getElementById('lc-detail-title')?.focus()
  }, [focusTick])

  const applyResponse = (response: LifecycleResponse) => {
    setState((current) => (current.status === 'ready'
      ? { ...current, appointment: response.turno, eventos: response.historial }
      : current))
    setNotice(null)
    setFocusTick((tick) => tick + 1)
  }

  const runMutation = async (operation: () => Promise<LifecycleResponse>): Promise<void> => {
    setBusy(true)
    setNotice(null)
    try {
      applyResponse(await operation())
    } catch (cause) {
      setNotice(toLifecycleProblem(cause).message)
      throw cause
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (estado: ChangeableStatus) => {
    void runMutation(() => lifecycleApi.changeStatus(id, { estado })).catch(() => undefined)
  }

  if (state.status === 'loading') {
    return <StatePanel state="loading" title="Cargando turno…" description="Esto puede tardar unos segundos." />
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        state="error"
        title="No se pudo cargar el detalle del turno"
        description={state.message}
        actionLabel="Reintentar"
        onAction={() => setAttempt((value) => value + 1)}
      />
    )
  }

  return (
    <div className="lc-page">
      {notice ? <p className="lc-notice" role="alert">{notice}</p> : null}
      <AppointmentDetail
        appointment={state.appointment}
        eventos={state.eventos}
        chairs={state.chairs}
        busy={busy}
        onReschedule={() => setModal('reschedule')}
        onCancel={() => setModal('cancel')}
        onChangeStatus={changeStatus}
      />
      <CancelModal
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        onConfirm={(motivo) => runMutation(() => lifecycleApi.cancel(id, { motivo }))}
      />
      <RescheduleModal
        open={modal === 'reschedule'}
        appointment={state.appointment}
        chairs={state.chairs}
        onClose={() => setModal(null)}
        onSave={(input: RescheduleInput) => runMutation(() => lifecycleApi.reschedule(id, input))}
      />
    </div>
  )
}
