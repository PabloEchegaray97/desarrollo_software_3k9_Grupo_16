import { useEffect, useId, useState, type FormEvent } from 'react'
import { AdminModal } from '../../catalog/ui/AdminModal'
import { Button } from '../../catalog/ui/Button'
import { TextField } from '../../catalog/ui/fields'
import { patientsApi } from '../../patients/api'
import type { Patient } from '../../patients/types'

interface PatientPickerProps {
  selected: Patient | null
  onSelect: (patient: Patient | null) => void
  error?: string
}

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; patients: Patient[] }

const MIN_QUERY_LENGTH = 3
const MAX_QUERY_LENGTH = 120
const MAX_RESULTS = 8

function containsControlCharacters(value: string): boolean {
  return Array.from(value, (character) => character.codePointAt(0) ?? 0)
    .some((codePoint) => codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
}

/** Busca pacientes activos únicamente después de validar y enviar una consulta explícita. */
export function PatientPicker({ selected, onSelect, error }: PatientPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [validationError, setValidationError] = useState<string>()
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' })
  const resultsId = useId()

  useEffect(() => {
    if (!isOpen || submittedQuery === null) return

    const controller = new AbortController()
    patientsApi.list({ q: submittedQuery, pageSize: MAX_RESULTS }, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setSearchState({ status: 'ready', patients: result.items })
      },
      () => {
        if (!controller.signal.aborted) setSearchState({ status: 'error' })
      },
    )
    return () => controller.abort()
  }, [isOpen, searchAttempt, submittedQuery])

  const openSearch = () => {
    setSearch('')
    setValidationError(undefined)
    setSubmittedQuery(null)
    setSearchState({ status: 'idle' })
    setIsOpen(true)
  }

  const closeSearch = () => {
    setIsOpen(false)
    setSubmittedQuery(null)
    setSearchState({ status: 'idle' })
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = search.trim()
    if (containsControlCharacters(query)) {
      setValidationError('La búsqueda contiene caracteres no permitidos.')
      return
    }
    if (query.length < MIN_QUERY_LENGTH) {
      setValidationError(`Escribí al menos ${MIN_QUERY_LENGTH} caracteres para buscar.`)
      return
    }
    if (query.length > MAX_QUERY_LENGTH) {
      setValidationError(`La búsqueda no puede superar ${MAX_QUERY_LENGTH} caracteres.`)
      return
    }

    setValidationError(undefined)
    setSearchState({ status: 'loading' })
    setSubmittedQuery(query)
    setSearchAttempt((attempt) => attempt + 1)
  }

  const retrySearch = () => {
    setSearchState({ status: 'loading' })
    setSearchAttempt((attempt) => attempt + 1)
  }

  return (
    <>
      <div className="app-field">
        <span className="app-field__label">Paciente</span>
        <div className={`apt-picker__trigger${selected ? ' apt-picker__trigger--selected' : ''}`} aria-live="polite">
          <span>
            {selected ? <><strong>{selected.nombre}</strong> <span className="apt-picker__meta">· {selected.telefono}{selected.dni ? ` · DNI ${selected.dni}` : ''}</span></> : null}
          </span>
          <Button size={selected ? 'sm' : 'md'} variant={selected ? 'ghost' : 'secondary'} onClick={openSearch}>
            {selected ? 'Cambiar paciente' : 'Buscar paciente'}
          </Button>
        </div>
        {error ? <p className="app-field__error" role="alert">{error}</p> : null}
      </div>

      <AdminModal
        open={isOpen}
        title="Buscar paciente"
        description={`Ingresá al menos ${MIN_QUERY_LENGTH} caracteres. Se muestran hasta ${MAX_RESULTS} coincidencias.`}
        onClose={closeSearch}
      >
        <form className="apt-picker__search" onSubmit={submitSearch} noValidate>
          <TextField
            label="Buscar pacientes"
            type="search"
            value={search}
            onValueChange={(value) => {
              setSearch(value)
              setValidationError(undefined)
              setSubmittedQuery(null)
              setSearchState({ status: 'idle' })
            }}
            placeholder="Nombre, teléfono o DNI"
            hint="Presioná Enter para buscar."
            error={validationError}
            autoComplete="off"
            autoFocus
            maxLength={MAX_QUERY_LENGTH}
            aria-controls={resultsId}
          />
          <Button type="submit" variant="primary" loading={searchState.status === 'loading'}>
            Buscar
          </Button>
        </form>

        <ul className="apt-picker__results" id={resultsId} aria-label="Pacientes encontrados" aria-busy={searchState.status === 'loading'}>
          {searchState.status === 'idle' ? (
            <li className="apt-picker__empty">Los resultados aparecerán después de una búsqueda.</li>
          ) : null}
          {searchState.status === 'loading' ? <li className="apt-picker__empty">Buscando pacientes…</li> : null}
          {searchState.status === 'error' ? (
            <li className="apt-picker__empty">No se pudo buscar. <Button size="sm" variant="ghost" onClick={retrySearch}>Reintentar</Button></li>
          ) : null}
          {searchState.status === 'ready' && searchState.patients.length === 0 ? (
            <li className="apt-picker__empty">Sin coincidencias para «{submittedQuery}».</li>
          ) : null}
          {searchState.status === 'ready'
            ? searchState.patients.map((patient) => (
              <li key={patient.id}>
                <button type="button" className="apt-picker__option" onClick={() => {
                  onSelect(patient)
                  closeSearch()
                }}>
                  <span>{patient.nombre}</span>
                  <span className="apt-picker__meta">{patient.telefono}</span>
                </button>
              </li>
            ))
            : null}
        </ul>
      </AdminModal>
    </>
  )
}
