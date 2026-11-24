import { useCallback, useId, useState } from 'react'
import { useDebouncedValue, useRemoteList } from '../../catalog/ui/hooks'
import { Button } from '../../catalog/ui/Button'
import { TextField } from '../../catalog/ui/fields'
import { patientsApi } from '../../patients/api'
import type { Patient } from '../../patients/types'

interface PatientPickerProps {
  selected: Patient | null
  onSelect: (patient: Patient | null) => void
  error?: string
}

const MAX_RESULTS = 8

/** Busca solo pacientes activos (el backend excluye inactivos por defecto). */
export function PatientPicker({ selected, onSelect, error }: PatientPickerProps) {
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim())
  const resultsId = useId()
  const loader = useCallback((signal: AbortSignal) => patientsApi.list({ q: q || undefined, pageSize: MAX_RESULTS }, signal), [q])
  const { state, reload } = useRemoteList<Patient>(loader)

  if (selected) {
    return (
      <div className="adm-field">
        <span className="adm-field__label">Paciente</span>
        <div className="apt-picker__selected" aria-live="polite">
          <span><strong>{selected.nombre}</strong> <span className="apt-picker__meta">· {selected.telefono}{selected.dni ? ` · DNI ${selected.dni}` : ''}</span></span>
          <Button size="sm" variant="ghost" onClick={() => onSelect(null)}>Cambiar paciente</Button>
        </div>
        {error ? <p className="adm-field__error" role="alert">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="apt-picker">
      <TextField
        label="Paciente"
        type="search"
        value={search}
        onValueChange={setSearch}
        placeholder="Buscar por nombre, teléfono o DNI"
        hint="Elegí un paciente de la lista."
        error={error}
        autoComplete="off"
        aria-controls={resultsId}
      />
      <ul className="apt-picker__results" id={resultsId} aria-label="Pacientes encontrados" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' ? <li className="apt-picker__empty">Buscando pacientes…</li> : null}
        {state.status === 'error' ? (
          <li className="apt-picker__empty">No se pudo buscar. <Button size="sm" variant="ghost" onClick={reload}>Reintentar</Button></li>
        ) : null}
        {state.status === 'ready' && state.data.items.length === 0 ? (
          <li className="apt-picker__empty">{q ? `Sin coincidencias para «${q}».` : 'Todavía no hay pacientes registrados.'}</li>
        ) : null}
        {state.status === 'ready'
          ? state.data.items.map((patient) => (
            <li key={patient.id}>
              <button type="button" className="apt-picker__option" onClick={() => onSelect(patient)}>
                <span>{patient.nombre}</span>
                <span className="apt-picker__meta">{patient.telefono}</span>
              </button>
            </li>
          ))
          : null}
      </ul>
    </div>
  )
}
