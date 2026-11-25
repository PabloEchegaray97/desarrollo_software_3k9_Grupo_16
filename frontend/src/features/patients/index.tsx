import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CaretLeft,
  CaretRight,
  DownloadSimple,
  FunnelSimple,
  ListBullets,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Table,
  UserCheck,
  UserMinus,
  Users,
} from '@phosphor-icons/react'
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

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function PatientsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('detail')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ patient: Patient | null } | null>(null)
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

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id)
    if (!selected && selectedId !== null) setSelectedId(null)
  }, [selected, selectedId])

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
      reload()
    } catch {
      setStatus('No se pudo cambiar el estado del paciente.')
    } finally {
      setBusyId(null)
    }
  }

  function exportPatients() {
    if (patients.length === 0) return
    const header = ['Nombre', 'Teléfono', 'DNI', 'Email', 'Estado']
    const rows = patients.map((patient) => [patient.nombre, patient.telefono, patient.dni ?? '', patient.email ?? '', patient.activo ? 'Activo' : 'Inactivo'])
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `pacientes-pagina-${page}.csv`
    link.click()
    URL.revokeObjectURL(url)
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
        <button key={patient.id} type="button" className="clients-list-item" aria-pressed={selected?.id === patient.id} onClick={() => setSelectedId(patient.id)}>
          <span className="clients-avatar">{initials(patient.nombre)}</span>
          <span className="clients-list-item__body"><strong>{patient.nombre}</strong><small>{patient.telefono}</small></span>
          <span className="clients-list-item__indicator" aria-hidden="true" />
        </button>
      ))}
    </div>
  )

  return (
    <section className="clients-page">
      <header className="clients-page__titlebar">
        <div><h1 className="page-heading">Clientes</h1><p className="page-lead">Gestioná tu base de pacientes y sus datos.</p></div>
        <div className="clients-page__actions">
          <Button variant="secondary" leftIcon={<DownloadSimple />} onClick={exportPatients} disabled={patients.length === 0}>Exportar</Button>
          <Button variant="primary" leftIcon={<Plus />} onClick={() => setEditing({ patient: null })}>Nuevo paciente</Button>
        </div>
      </header>

      <section className="catalog-kpis" aria-label="Resumen de pacientes">
        <div><span><small>Total</small><strong>{total}</strong></span><Users size={20} aria-hidden="true" /></div>
        <div><span><small>Activos en página</small><strong>{active}</strong></span><UserCheck size={20} aria-hidden="true" /></div>
        <div><span><small>Inactivos en página</small><strong>{inactive}</strong></span><UserMinus size={20} aria-hidden="true" /></div>
      </section>

      <div className={`clients-workspace${viewMode === 'table' ? ' clients-workspace--table' : ''}`}>
        <section className="clients-panel clients-panel--list">
          <header className="clients-panel__toolbar">
            <span className="clients-panel__filter-label"><FunnelSimple size={15} /> Filtros</span>
            <div className="clients-view-switch" aria-label="Vista de pacientes">
              <button type="button" aria-pressed={viewMode === 'detail'} onClick={() => setViewMode('detail')}><ListBullets size={15} /> Detalle</button>
              <button type="button" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><Table size={15} /> Tabla</button>
            </div>
          </header>

          <div className="clients-search-row">
            <label className="clients-search">
              <span>Buscar cliente</span>
              <span className="clients-search__control"><MagnifyingGlass size={17} aria-hidden="true" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Nombre, teléfono o DNI" /></span>
            </label>
            <div className="clients-filter" aria-label="Estado del paciente">
              {(['all', 'active', 'inactive'] as const).map((value) => (
                <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => { setStatusFilter(value); setPage(1) }}>
                  {value === 'all' ? 'Todos' : value === 'active' ? 'Activos' : 'Inactivos'}
                </button>
              ))}
            </div>
          </div>

          <p className="clients-status" role="status">{status}</p>

          {viewMode === 'table' && state.status === 'ready' && patients.length > 0 ? (
            <div className="clients-table-wrap">
              <table className="clients-table">
                <thead><tr><th>Cliente</th><th>Teléfono</th><th>DNI</th><th>Email</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
                <tbody>{patients.map((patient) => (
                  <tr key={patient.id} data-selected={selected?.id === patient.id} onClick={() => setSelectedId(patient.id)}>
                    <td><span className="clients-avatar">{initials(patient.nombre)}</span><strong>{patient.nombre}</strong></td>
                    <td>{patient.telefono}</td><td>{patient.dni || '—'}</td><td>{patient.email || '—'}</td><td>{patient.activo ? 'Activo' : 'Inactivo'}</td>
                    <td><button type="button" className="clients-icon-button" aria-label={`Editar ${patient.nombre}`} onClick={(event) => { event.stopPropagation(); setEditing({ patient }) }}><PencilSimple size={16} /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : viewMode === 'detail' ? listContent : null}

          {state.status === 'ready' && state.data.total > 0 ? (
            <footer className="clients-pagination">
              <button type="button" aria-label="Página anterior" onClick={() => setPage((current) => current - 1)} disabled={page <= 1}><CaretLeft size={15} /></button>
              <span>Página {page} de {totalPages} · {state.data.total} clientes</span>
              <button type="button" aria-label="Página siguiente" onClick={() => setPage((current) => current + 1)} disabled={page >= totalPages}><CaretRight size={15} /></button>
            </footer>
          ) : null}
        </section>

        {viewMode === 'detail' ? <PatientDetail patient={selected} onEdit={selected ? () => setEditing({ patient: selected }) : undefined} onToggle={selected ? () => void toggle(selected) : undefined} busy={busyId === selected?.id} /> : null}
      </div>

      <button type="button" className="clients-fab" aria-label="Crear paciente" onClick={() => setEditing({ patient: null })}><Plus size={20} /></button>
      {editing ? <PatientForm patient={editing.patient} onClose={() => setEditing(null)} onSaved={saved} /> : null}
    </section>
  )
}
