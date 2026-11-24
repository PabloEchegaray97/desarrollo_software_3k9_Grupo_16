import { useCallback, useEffect, useState } from 'react'
import { StatePanel } from '../../../shared/components/StatePanel'
import { chairsApi, proceduresApi } from '../../catalog/api'
import '../../catalog/ui/admin-ui.css'
import type { Patient } from '../../patients/types'
import { getAgendaConfiguration } from './api'
import { AppointmentForm, type BookingOptions } from './AppointmentForm'
import { AppointmentSummary } from './AppointmentSummary'
import './create.css'
import type { Appointment } from './types'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; options: BookingOptions }

const OPTIONS_PAGE_SIZE = 100

interface Created {
  appointment: Appointment
  patient: Patient
}

export function AppointmentCreationPage() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [created, setCreated] = useState<Created | null>(null)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoad({ status: 'loading' })
    // Solo opciones activas: el backend excluye inactivos por defecto.
    Promise.all([
      proceduresApi.list({ pageSize: OPTIONS_PAGE_SIZE }, controller.signal),
      chairsApi.list({ pageSize: OPTIONS_PAGE_SIZE }, controller.signal),
      getAgendaConfiguration(controller.signal),
    ]).then(
      ([procedures, chairs, configuration]) => {
        if (!controller.signal.aborted) {
          setLoad({ status: 'ready', options: { procedures: procedures.items, chairs: chairs.items, globalIntervalMinutes: configuration.intervaloGlobalMinutos } })
        }
      },
      () => { if (!controller.signal.aborted) setLoad({ status: 'error' }) },
    )
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (created) document.getElementById('apt-summary-title')?.focus()
  }, [created])

  const onCreated = useCallback((appointment: Appointment, patient: Patient) => setCreated({ appointment, patient }), [])

  const createAnother = () => {
    setCreated(null)
    setFormKey((key) => key + 1)
  }

  return (
    <section className="adm-page">
      <header className="adm-page__header">
        <div>
          <h1 className="page-heading">Nuevo turno</h1>
          <p className="page-lead">Elegí paciente, prestación, sillón y horario. El sistema verifica la disponibilidad y que no se superponga con otros turnos.</p>
        </div>
      </header>

      {load.status === 'loading' ? (
        <StatePanel state="loading" title="Cargando prestaciones y sillones…" description="Esto puede tardar unos segundos." />
      ) : load.status === 'error' ? (
        <StatePanel state="error" title="No se pudieron cargar las opciones" description="Revisá la conexión e intentá de nuevo." actionLabel="Reintentar" onAction={() => setAttempt((value) => value + 1)} />
      ) : load.options.procedures.length === 0 || load.options.chairs.length === 0 ? (
        <StatePanel
          state="empty"
          title="Faltan prestaciones o sillones activos"
          description="Registrá al menos una prestación y un sillón en Prestaciones y sillones para poder dar turnos."
        />
      ) : created ? (
        <AppointmentSummary
          appointment={created.appointment}
          patientName={created.patient.nombre}
          procedureName={load.options.procedures.find((item) => item.id === created.appointment.prestacionId)?.nombre ?? '—'}
          chairName={load.options.chairs.find((item) => item.id === created.appointment.sillonId)?.nombre ?? '—'}
          onCreateAnother={createAnother}
        />
      ) : (
        <AppointmentForm key={formKey} options={load.options} onCreated={onCreated} />
      )}
    </section>
  )
}
