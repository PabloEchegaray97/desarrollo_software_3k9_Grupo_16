import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowCounterClockwise,
  CaretLeft,
  CaretRight,
  FunnelSimple,
  IdentificationCard,
  ListBullets,
  PencilSimple,
  Plus,
  Table,
  Trash,
  UserCheck,
  UserMinus,
  Users,
} from '@phosphor-icons/react'
import { sileo } from 'sileo'
import { Link } from 'react-router-dom'
import { AppModal } from '../../shared/components/AppModal'
import { FilterModal } from '../../shared/components/FilterModal'
import { SearchInput } from '../../shared/components/SearchInput'
import { StatePanel } from '../../shared/components/StatePanel'
import { Button } from '../catalog/ui/Button'
import { useDebouncedValue, useRemoteList } from '../catalog/ui/hooks'
import '../catalog/ui/admin-ui.css'
import { patientsApi } from './api'
import { PatientDetail } from './PatientDetail'
import { PatientForm } from './PatientForm'
import type { Patient } from './types'

type StatusFilter = 'all' | 'active' | 'inactive'
type ViewMode = 'detail' | 'table'
const PAGE_SIZE = 20

export function describePatient(patient: Patient): string {
  return [patient.telefono, patient.dni ? `DNI ${patient.dni}` : null, patient.email].filter(Boolean).join(' · ')
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('es-AR')).join('')
}

export function PatientsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('detail')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileDetailId, setMobileDetailId] = useState<string | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [actionsPatient, setActionsPatient] = useState<Patient | null>(null)
  const [editing, setEditing] = useState<{ patient: Patient | null } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const query = useDebouncedValue(search.trim())

  const loader = useCallback(
    (signal: AbortSignal) => patientsApi.list({
      q: query || undefined,
      incluirInactivos: statusFilter !== 'active',
      page,
      pageSize: PAGE_SIZE,
    }, signal),
    [page, query, statusFilter],
  )
  const { state, reload } = useRemoteList(loader)
  const remoteItems = state.status === 'ready' ? state.data.items : []
  const patients = useMemo(
    () => remoteItems.filter((patient) => statusFilter === 'all' || patient.activo === (statusFilter === 'active')),
    [remoteItems, statusFilter],
  )
  const selected = patients.find((patient) => patient.id === selectedId) ?? patients[0] ?? null
  const mobileDetail = patients.find((patient) => patient.id === mobileDetailId) ?? null
  const showTableView = viewMode === 'table' && !isMobileViewport

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(max-width: 48rem)')
    const updateViewport = () => {
      setIsMobileViewport(mediaQuery.matches)
      if (!mediaQuery.matches) setMobileDetailId(null)
    }

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [])

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id)
    if (!selected && selectedId !== null) setSelectedId(null)
  }, [selected, selectedId])

  useEffect(() => {
    if (mobileDetailId && (!isMobileViewport || !mobileDetail)) setMobileDetailId(null)
  }, [isMobileViewport, mobileDetail, mobileDetailId])

  function selectPatient(patient: Patient) {
    setSelectedId(patient.id)
    if (isMobileViewport) setMobileDetailId(patient.id)
  }

  const showMobileFab = isMobileViewport && !mobileDetailId && !actionsPatient && !filtersOpen && !editing && !deleteTarget

  function saved(patient: Patient) {
    setEditing(null)
    setSelectedId(patient.id)
    setStatus(`Paciente «${patient.nombre}» guardado.`)
    reload()
  }

  async function toggle(patient: Patient) {
    setBusyId(patient.id)
    try {
      const updated = await patientsApi.setActive(patient.id, !patient.activo)
      setStatus(`Paciente «${updated.nombre}» ${updated.activo ? 'reactivado' : 'desactivado'}.`)
      if (!updated.activo) {
        setDeleteTarget(null)
        sileo.success({ title: 'Cliente eliminado', description: `${updated.nombre} quedó inactivo.` })
      } else {
        sileo.success({ title: 'Cliente reactivado', description: `${updated.nombre} vuelve a estar disponible.` })
      }
      reload()
    } catch {
      setStatus('No se pudo cambiar el estado del paciente.')
      sileo.error({ title: 'No se pudo completar la acción', description: 'Intentá nuevamente en unos segundos.' })
    } finally {
      setBusyId(null)
    }
  }

  const total = state.status === 'ready' ? state.data.total : 0
  const active = remoteItems.filter((patient) => patient.activo).length
  const inactive = remoteItems.length - active
  const totalPages = state.status === 'ready' ? Math.max(1, Math.ceil(state.data.total / state.data.pageSize)) : 1

  const listContent = state.status === 'loading' ? (
    <StatePanel state="loading" title="Cargando pacientes…" description="" />
  ) : state.status === 'error' ? (
    <StatePanel state="error" title="No se pudieron cargar los pacientes" description={state.message} actionLabel="Reintentar" onAction={reload} />
  ) : patients.length === 0 ? (
    <StatePanel state="empty" title={query ? 'Sin resultados' : 'Todavía no hay pacientes'} description={query ? `No encontramos coincidencias con «${query}».` : 'Usá “Nuevo paciente” para registrar el primero.'} />
  ) : (
    <div className="clients-list">
      {patients.map((patient) => (
        <button key={patient.id} type="button" className="clients-list-item" aria-pressed={selected?.id === patient.id} onClick={() => selectPatient(patient)}>
          <span className="clients-avatar">{initials(patient.nombre)}</span>
          <span className="clients-list-item__body"><strong>{patient.nombre}</strong><small>{patient.dni ?? 'DNI no registrado'}</small></span>
          <span className="clients-list-item__indicator" aria-hidden="true" />
        </button>
      ))}
    </div>
  )

  return (
    <section className="clients-page">
      <header className="clients-page__titlebar">
        <div><h1 className="page-heading">Pacientes</h1><p className="page-lead">Gestioná tu base de pacientes y sus datos.</p></div>
        <div className="clients-page__actions">
          <Button className="clients-page__create" variant="primary" leftIcon={<Plus />} onClick={() => setEditing({ patient: null })}>Nuevo paciente</Button>
        </div>
      </header>

      <section className="catalog-kpis" aria-label="Resumen de pacientes">
        <div><span><small>Total</small><strong>{total}</strong></span><Users size={20} aria-hidden="true" /></div>
        <div><span><small>Activos en página</small><strong>{active}</strong></span><UserCheck size={20} aria-hidden="true" /></div>
        <div><span><small>Inactivos en página</small><strong>{inactive}</strong></span><UserMinus size={20} aria-hidden="true" /></div>
      </section>

      <div className={`clients-workspace${showTableView ? ' clients-workspace--table' : ''}`}>
        <section className="clients-panel clients-panel--list">
          <header className="clients-panel__toolbar">
            <SearchInput
              value={search}
              onChange={(value) => { setSearch(value); setPage(1) }}
              onSearch={() => setPage(1)}
              placeholder="Nombre, teléfono o DNI"
              aria-label="Buscar cliente"
            />
            <div className="clients-panel__toolbar-controls">
              <Button
                variant="secondary"
                leftIcon={<FunnelSimple />}
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(true)}
              >
                Filtros{statusFilter !== 'all' ? ' (1)' : ''}
              </Button>
              <div className="clients-view-switch" aria-label="Vista de pacientes">
                <button type="button" aria-pressed={viewMode === 'detail'} onClick={() => setViewMode('detail')}><ListBullets size={15} /> Detalle</button>
                <button type="button" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><Table size={15} /> Tabla</button>
              </div>
            </div>
          </header>

          <p className="clients-status" role="status">{status}</p>

          {showTableView && state.status === 'ready' && patients.length > 0 ? (
            <div className="clients-table-wrap">
              <table className="clients-table">
                <thead><tr><th>Cliente</th><th>Teléfono</th><th>DNI</th><th>Email</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
                <tbody>{patients.map((patient) => (
                  <tr key={patient.id} data-selected={selected?.id === patient.id} onClick={() => selectPatient(patient)}>
                    <td><span className="clients-avatar">{initials(patient.nombre)}</span><strong>{patient.nombre}</strong></td>
                    <td>{patient.telefono}</td><td>{patient.dni || '—'}</td><td>{patient.email || '—'}</td><td>{patient.activo ? 'Activo' : 'Inactivo'}</td>
                    <td><button type="button" className="clients-icon-button" aria-label={`Editar ${patient.nombre}`} onClick={(event) => { event.stopPropagation(); setEditing({ patient }) }}><PencilSimple size={16} /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : viewMode === 'detail' || isMobileViewport ? listContent : null}

          {state.status === 'ready' && state.data.total > 0 ? (
            <footer className="clients-pagination">
              <button type="button" aria-label="Página anterior" onClick={() => setPage((current) => current - 1)} disabled={page <= 1}><CaretLeft size={15} /></button>
              <span>Página {page} de {totalPages} · {state.data.total} clientes</span>
              <button type="button" aria-label="Página siguiente" onClick={() => setPage((current) => current + 1)} disabled={page >= totalPages}><CaretRight size={15} /></button>
            </footer>
          ) : null}
        </section>

        {viewMode === 'detail' && !isMobileViewport ? <PatientDetail patient={selected} onEdit={selected ? () => setEditing({ patient: selected }) : undefined} onToggle={selected ? () => { if (selected.activo) setDeleteTarget(selected); else void toggle(selected) } : undefined} busy={busyId === selected?.id} /> : null}
      </div>

      {showMobileFab ? <button type="button" className="clients-fab" onClick={() => setEditing({ patient: null })}><Plus size={20} aria-hidden="true" /><span>Nuevo paciente</span></button> : null}
      {editing ? <PatientForm patient={editing.patient} onClose={() => setEditing(null)} onSaved={saved} /> : null}
      {isMobileViewport && mobileDetail ? (
        <AppModal
          open
          title={mobileDetail.nombre}
          onClose={() => setMobileDetailId(null)}
          className="patient-detail-sheet app-modal--compact-sheet"
          closeLabel="Cerrar detalle del paciente"
        >
          <PatientDetail
            patient={mobileDetail}
            actionsMode="sheet-trigger"
            onOpenActions={() => setActionsPatient(mobileDetail)}
          />
        </AppModal>
      ) : null}
      {isMobileViewport && actionsPatient ? (
        <AppModal
          open
          title="Acciones del paciente"
          description={actionsPatient.nombre}
          onClose={() => setActionsPatient(null)}
          className="patient-actions-sheet app-modal--compact-sheet"
          closeLabel="Cerrar acciones del paciente"
        >
          <div className="patient-actions-sheet__actions">
            <Button
              variant="secondary"
              leftIcon={<PencilSimple />}
              onClick={() => {
                setActionsPatient(null)
                setEditing({ patient: actionsPatient })
              }}
            >
              Editar paciente
            </Button>
            <Button
              variant={actionsPatient.activo ? 'danger' : 'secondary'}
              leftIcon={actionsPatient.activo ? <Trash /> : <ArrowCounterClockwise />}
              loading={busyId === actionsPatient.id}
              onClick={() => {
                const patient = actionsPatient
                setActionsPatient(null)
                if (patient.activo) setDeleteTarget(patient)
                else void toggle(patient)
              }}
            >
              {actionsPatient.activo ? 'Eliminar cliente' : 'Reactivar cliente'}
            </Button>
            <Link
              className="app-button app-button--secondary app-button--sm adm-button adm-button--secondary"
              to={`/pacientes/${actionsPatient.id}`}
              onClick={() => {
                setActionsPatient(null)
                setMobileDetailId(null)
              }}
            >
              <IdentificationCard size={16} aria-hidden="true" />
              Ver perfil
            </Link>
          </div>
        </AppModal>
      ) : null}
      <AppModal
        open={deleteTarget !== null}
        title="Eliminar cliente"
        description="El cliente quedará inactivo y no podrá seleccionarse en nuevos turnos."
        onClose={() => { if (!busyId) setDeleteTarget(null) }}
        className="clients-patient-modal"
        footer={(
          <>
            <Button variant="ghost" disabled={busyId !== null} onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" leftIcon={<Trash />} loading={busyId !== null} loadingText="Eliminando…" onClick={() => { if (deleteTarget) void toggle(deleteTarget) }}>Eliminar cliente</Button>
          </>
        )}
      >
        {deleteTarget ? <div className="delete-confirmation"><strong>{deleteTarget.nombre}</strong><span>Podrás reactivarlo más adelante desde el filtro de inactivos.</span></div> : null}
      </AppModal>
      <FilterModal
        open={filtersOpen}
        title="Filtros"
        description="Filtrá los pacientes por estado."
        onClose={() => setFiltersOpen(false)}
        onClear={() => {
          setStatusFilter('all')
          setPage(1)
        }}
        onApply={() => setFiltersOpen(false)}
      >
        <div className="filter-modal__field">
          <label htmlFor="patients-filter-status">Estado</label>
          <select
            id="patients-filter-status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter)
              setPage(1)
            }}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </FilterModal>
    </section>
  )
}
