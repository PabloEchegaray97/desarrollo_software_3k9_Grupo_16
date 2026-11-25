import { useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, type Location as RouterLocation } from 'react-router-dom'
import { AppointmentCreationPage } from '../features/appointments/create'
import { AppointmentLifecyclePage } from '../features/appointments/lifecycle'
import { AppointmentAgendaPage } from '../features/agenda'
import { AvailabilityPage } from '../features/availability'
import { BlocksPage } from '../features/availability/blocks'
import { CatalogPage } from '../features/catalog'
import { PatientsPage } from '../features/patients'
import { PatientProfilePage } from '../features/patients/PatientProfilePage'
import { AppModal } from '../shared/components/AppModal'
import { PracticeDashboard } from './dashboard'
import { authRoute } from './routes/auth.routes'

const DASHBOARD_LOCATION: RouterLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'dashboard',
}

interface BackgroundRoute {
  location: RouterLocation
  direct: boolean
}

function isRouterLocation(value: unknown): value is RouterLocation {
  if (typeof value !== 'object' || value === null) return false
  return (
    'pathname' in value &&
    typeof value.pathname === 'string' &&
    'search' in value &&
    typeof value.search === 'string' &&
    'hash' in value &&
    typeof value.hash === 'string' &&
    'state' in value &&
    'key' in value &&
    typeof value.key === 'string'
  )
}

function getBackgroundRoute(location: RouterLocation): BackgroundRoute | null {
  const state = location.state
  if (
    typeof state === 'object' &&
    state !== null &&
    'backgroundLocation' in state &&
    isRouterLocation(state.backgroundLocation)
  ) {
    return { location: state.backgroundLocation, direct: false }
  }
  return location.pathname === '/turnos/nuevo'
    ? { location: DASHBOARD_LOCATION, direct: true }
    : null
}

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: 'Elegí el servicio y sillón',
  2: 'Elegí el día y horario',
  3: 'Elegí el paciente',
}

function AppointmentCreationModal({ background }: { background: BackgroundRoute }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [completed, setCompleted] = useState(false)
  const close = () => {
    if (background.direct) navigate('/', { replace: true })
    else navigate(-1)
  }

  return (
    <AppModal
      open
      className="appointment-wizard-modal"
      title={completed ? 'Detalle del turno' : 'Nuevo turno'}
      description={completed ? undefined : `Paso ${step} de 3 · ${STEP_DESCRIPTIONS[step] ?? ''}`}
      closeLabel="Cerrar alta de turno"
      onClose={close}
      progress={completed ? undefined : { current: step, total: 3, label: 'Progreso de la nueva reserva' }}
    >
      <AppointmentCreationPage onClose={close} onStepChange={setStep} onCompletionChange={setCompleted} />
    </AppModal>
  )
}

export function AppRoutes() {
  const location = useLocation()
  const background = getBackgroundRoute(location)

  return (
    <>
      <Routes location={background?.location ?? location}>
        <Route path="/" element={<PracticeDashboard />} />
        <Route path="/agenda" element={<AppointmentAgendaPage />} />
        <Route path="/turnos/nuevo" element={<AppointmentCreationPage />} />
        <Route path="/turnos/:appointmentId" element={<AppointmentLifecyclePage />} />
        <Route path="/pacientes" element={<PatientsPage />} />
        <Route path="/pacientes/:patientId" element={<PatientProfilePage />} />
        <Route path="/prestaciones" element={<CatalogPage />} />
        <Route path="/servicios" element={<Navigate to="/prestaciones" replace />} />
        <Route path="/disponibilidad" element={<AvailabilityPage />} />
        <Route path="/bloqueos" element={<BlocksPage />} />
        <Route path={authRoute.path} element={authRoute.element} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {background ? (
        <Routes>
          <Route path="/turnos/nuevo" element={<AppointmentCreationModal background={background} />} />
        </Routes>
      ) : null}
    </>
  )
}
