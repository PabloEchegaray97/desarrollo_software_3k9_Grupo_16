import { Navigate, Route, Routes, useLocation, useNavigate, type Location as RouterLocation } from 'react-router-dom'
import { AppointmentCreationPage } from '../features/appointments/create'
import { AppointmentLifecyclePage } from '../features/appointments/lifecycle'
import { AppointmentAgendaPage } from '../features/agenda'
import { AvailabilityPage } from '../features/availability'
import { CatalogPage } from '../features/catalog'
import { PatientsPage } from '../features/patients'
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

function AppointmentCreationModal({ background }: { background: BackgroundRoute }) {
  const navigate = useNavigate()
  const close = () => {
    if (background.direct) navigate('/', { replace: true })
    else navigate(-1)
  }

  return (
    <AppModal
      open
      title="Nuevo turno"
      closeLabel="Cerrar alta de turno"
      onClose={close}
    >
      <AppointmentCreationPage onClose={close} />
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
        <Route path="/prestaciones" element={<CatalogPage />} />
        <Route path="/disponibilidad" element={<AvailabilityPage />} />
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
