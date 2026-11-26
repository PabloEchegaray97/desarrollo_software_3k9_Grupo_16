import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { sileo } from 'sileo'
import { StatePanel } from '../../../shared/components/StatePanel'
import { chairsApi, proceduresApi } from '../../catalog/api'
import type { Chair, Procedure } from '../../catalog/types'
import { patientsApi } from '../../patients/api'
import type { Patient } from '../../patients/types'
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

const STATUS_SUCCESS: Record<ChangeableStatus, string> = {
  CONFIRMADO: 'Turno confirmado',
  ATENDIDO: 'Turno marcado como atendido',
  AUSENTE: 'Ausencia registrada',
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; appointment: LifecycleAppointment; eventos: LifecycleEvent[]; chairs: Chair[]; patients: Patient[]; procedures: Procedure[] }

/** La página solo presenta respuestas del backend: nunca calcula disponibilidad ni ventanas temporales. */
export function AppointmentLifecyclePage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const id = appointmentId ?? ''
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const requestedAction = readDashboardAction(location.state)
  const [modal, setModal] = useState<'reschedule' | 'cancel' | null>(requestedAction)
  const [busy, setBusy] = useState(false)
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
        const [detalle, historial, catalogo, pacientes, prestaciones] = await Promise.all([
          lifecycleApi.getAppointment(id, controller.signal),
          lifecycleApi.getHistory(id, controller.signal),
          chairsApi.list({ pageSize: 100 }, controller.signal),
          patientsApi.list({ pageSize: 100, incluirInactivos: true }, controller.signal),
          proceduresApi.list({ pageSize: 100, incluirInactivos: true }, controller.signal),
        ])
        if (!active) return
        setState({
          status: 'ready',
          appointment: detalle.turno,
          eventos: historial.eventos,
          chairs: catalogo.items,
          patients: pacientes.items,
          procedures: prestaciones.items,
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
    setFocusTick((tick) => tick + 1)
  }

  /** Los modales muestran sus propios errores; acá solo se aplica la respuesta y se avisa el éxito. */
  const runMutation = async (operation: () => Promise<LifecycleResponse>, successTitle: string): Promise<void> => {
    setBusy(true)
    try {
      applyResponse(await operation())
      sileo.success({ title: successTitle })
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (estado: ChangeableStatus) => {
    void runMutation(() => lifecycleApi.changeStatus(id, { estado }), STATUS_SUCCESS[estado]).catch((cause: unknown) => {
      sileo.error({ title: 'No se pudo actualizar el turno', description: toLifecycleProblem(cause).message })
    })
  }

  const closeModal = () => {
    setModal(null)
    if (requestedAction) navigate(location.pathname, { replace: true, state: null })
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
      <AppointmentDetail
        appointment={state.appointment}
        eventos={state.eventos}
        chairs={state.chairs}
        patients={state.patients}
        procedures={state.procedures}
        busy={busy}
        onBack={() => navigate('/agenda')}
        onReschedule={() => setModal('reschedule')}
        onCancel={() => setModal('cancel')}
        onChangeStatus={changeStatus}
      />
      <CancelModal
        open={modal === 'cancel'}
        onClose={closeModal}
        onConfirm={(motivo) => runMutation(() => lifecycleApi.cancel(id, { motivo }), 'Turno cancelado')}
      />
      <RescheduleModal
        open={modal === 'reschedule'}
        appointment={state.appointment}
        chairs={state.chairs}
        onClose={closeModal}
        onSave={(input: RescheduleInput) => runMutation(() => lifecycleApi.reschedule(id, input), 'Turno reprogramado')}
      />
    </div>
  )
}

function readDashboardAction(state: unknown): 'reschedule' | 'cancel' | null {
  if (!state || typeof state !== 'object' || !('dashboardAction' in state)) return null
  const action = state.dashboardAction
  return action === 'reschedule' || action === 'cancel' ? action : null
}
