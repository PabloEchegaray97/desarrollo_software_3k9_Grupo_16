import { Navigate, Route, Routes } from 'react-router-dom'
import { AppointmentCreationPage } from '../features/appointments/create'
import { AppointmentLifecyclePage } from '../features/appointments/lifecycle'
import { AppointmentAgendaPage } from '../features/agenda'
import { AvailabilityPage } from '../features/availability'
import { CatalogPage } from '../features/catalog'
import { PatientsPage } from '../features/patients'
import { StatePanel } from '../shared/components/StatePanel'
import { authRoute } from './routes/auth.routes'

function HomePage() {
  return <section><h1 className="page-heading">Agenda del consultorio</h1><p className="page-lead">Fundación técnica lista para incorporar los cambios funcionales sin mezclar dominios.</p><StatePanel state="empty" title="Todavía no hay turnos" description="La agenda se habilitará en los próximos changes del proyecto." /></section>
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/agenda" element={<AppointmentAgendaPage />} />
      <Route path="/turnos/nuevo" element={<AppointmentCreationPage />} />
      <Route path="/turnos/:appointmentId" element={<AppointmentLifecyclePage />} />
      <Route path="/pacientes" element={<PatientsPage />} />
      <Route path="/prestaciones" element={<CatalogPage />} />
      <Route path="/disponibilidad" element={<AvailabilityPage />} />
      <Route path={authRoute.path} element={authRoute.element} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
