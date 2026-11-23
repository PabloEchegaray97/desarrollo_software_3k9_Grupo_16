import { useCallback } from 'react'
import { CatalogPanel } from '../catalog/CatalogPanel'
import type { CatalogListParams } from '../catalog/types'
import '../catalog/ui/admin-ui.css'
import { patientsApi } from './api'
import { PatientForm } from './PatientForm'
import type { Patient } from './types'

export function describePatient(patient: Patient): string {
  return [patient.telefono, patient.dni ? `DNI ${patient.dni}` : null, patient.email].filter(Boolean).join(' · ')
}

export function PatientsPage() {
  const loadPatients = useCallback((params: CatalogListParams, signal: AbortSignal) => patientsApi.list(params, signal), [])

  return (
    <section className="adm-page">
      <header className="adm-page__header">
        <div>
          <h1 className="page-heading">Pacientes</h1>
          <p className="page-lead">Registrá los datos mínimos para asignar turnos. Sin información clínica.</p>
        </div>
      </header>
      <CatalogPanel<Patient>
        noun={{ singular: 'paciente', plural: 'pacientes', article: 'el' }}
        load={loadPatients}
        setActive={patientsApi.setActive}
        describe={describePatient}
        searchPlaceholder="Nombre, teléfono o DNI"
        renderForm={(item, close, saved) => <PatientForm patient={item} onClose={close} onSaved={saved} />}
      />
    </section>
  )
}
