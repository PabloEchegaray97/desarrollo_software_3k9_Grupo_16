import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  ArrowCounterClockwise,
  CheckCircle,
  FunnelSimple,
  ListBullets,
  PencilSimple,
  Plus,
  Prohibit,
  Stack,
  Table,
  Trash,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { sileo } from 'sileo'
import { AppModal } from '../../shared/components/AppModal'
import { FilterModal } from '../../shared/components/FilterModal'
import { SearchInput } from '../../shared/components/SearchInput'
import { StatePanel } from '../../shared/components/StatePanel'
import type { CatalogListParams } from './types'
import { Button } from './ui/Button'
import { useDebouncedValue, useRemoteList } from './ui/hooks'
import { InactiveBadge, Pager, type Paginated } from './ui/list'

export interface CatalogItem {
  id: string
  nombre: string
  activo: boolean
}

interface CatalogPanelProps<T extends CatalogItem> {
  /** Sustantivos visibles para adaptar el panel a prestaciones o sillones. */
  noun: { singular: string; plural: string; article: 'la' | 'el' }
  Icon: PhosphorIcon
  load: (params: CatalogListParams, signal: AbortSignal) => Promise<Paginated<T>>
  setActive: (id: string, activo: boolean) => Promise<T>
  describe: (item: T) => ReactNode
  renderForm: (item: T | null, close: () => void, saved: (item: T) => void) => ReactNode
  renderDetail?: (item: T | null) => ReactNode
  renderSummary?: (page: Paginated<T>) => ReactNode
  searchPlaceholder?: string
  tabs?: ReactNode
  createRequestKey?: number
  onCreateRequestHandled?: () => void
  mobileDetailSheets?: boolean
  /** En mobile, el click en un ítem abre el sheet de acciones directamente, sin pasar por el detalle. */
  mobileDirectActions?: boolean
}

const PAGE_SIZE = 20

export function CatalogPanel<T extends CatalogItem>({ noun, Icon, load, setActive, describe, renderForm, renderDetail, renderSummary, searchPlaceholder = 'Buscar por nombre', tabs, createRequestKey = 0, onCreateRequestHandled, mobileDetailSheets = false, mobileDirectActions = false }: CatalogPanelProps<T>) {
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'detail' | 'table'>('detail')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<{ item: T | null } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileDetailId, setMobileDetailId] = useState<string | null>(null)
  const [mobileActionsId, setMobileActionsId] = useState<string | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [status, setStatus] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const q = useDebouncedValue(search.trim())
  const ending = noun.article === 'la' ? 'a' : 'o'
  const newLabel = `${noun.article === 'la' ? 'Nueva' : 'Nuevo'} ${noun.singular}`

  const loader = useCallback(
    (signal: AbortSignal) => load({ q: q || undefined, incluirInactivos: includeInactive, page, pageSize: PAGE_SIZE }, signal),
    [load, q, includeInactive, page],
  )
  const { state, reload } = useRemoteList(loader)
  const items = state.status === 'ready' ? state.data.items : []
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null
  const mobileDetailItem = items.find((item) => item.id === mobileDetailId) ?? null
  const mobileActionsItem = items.find((item) => item.id === mobileActionsId) ?? null
  const mobileMode = mobileDetailSheets && isMobileViewport
  const showTableView = viewMode === 'table' && !mobileMode
  const showMobileFab = mobileMode && !mobileDetailId && !mobileActionsId && !filtersOpen && !editing && !deleteTarget
  const activeOnPage = items.filter((item) => item.activo).length
  const inactiveOnPage = items.length - activeOnPage

  useEffect(() => {
    if (!mobileDetailSheets || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(max-width: 48rem)')
    const updateViewport = () => {
      setIsMobileViewport(mediaQuery.matches)
      if (!mediaQuery.matches) {
        setMobileDetailId(null)
        setMobileActionsId(null)
      }
    }

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [mobileDetailSheets])

  useEffect(() => {
    if (mobileDetailId && (!mobileMode || !mobileDetailItem)) setMobileDetailId(null)
    if (mobileActionsId && (!mobileMode || !mobileActionsItem)) setMobileActionsId(null)
  }, [mobileActionsId, mobileActionsItem, mobileDetailId, mobileDetailItem, mobileMode])

  useEffect(() => {
    if (createRequestKey <= 0) return
    setEditing({ item: null })
    onCreateRequestHandled?.()
  }, [createRequestKey, onCreateRequestHandled])

  async function toggle(item: T) {
    setBusyId(item.id)
    try {
      const updated = await setActive(item.id, !item.activo)
      setStatus(`${capitalize(noun.singular)} «${updated.nombre}» ${updated.activo ? 'reactivad' : 'desactivad'}${ending}.`)
      if (!updated.activo) {
        setDeleteTarget(null)
        sileo.success({ title: `${capitalize(noun.singular)} eliminad${ending}`, description: `${updated.nombre} quedó inactiv${ending}.` })
      } else {
        sileo.success({ title: `${capitalize(noun.singular)} reactivad${ending}`, description: `${updated.nombre} vuelve a estar disponible.` })
      }
      reload()
    } catch {
      setStatus(`No se pudo cambiar el estado de ${noun.article} ${noun.singular}. Intentá de nuevo.`)
      sileo.error({ title: 'No se pudo completar la acción', description: 'Intentá nuevamente en unos segundos.' })
    } finally {
      setBusyId(null)
    }
  }

  function saved(item: T) {
    setEditing(null)
    setStatus(`${capitalize(noun.singular)} «${item.nombre}» guardad${ending}.`)
    reload()
  }

  function selectItem(item: T) {
    setSelectedId(item.id)
    if (mobileMode) {
      if (mobileDirectActions) setMobileActionsId(item.id)
      else setMobileDetailId(item.id)
    }
  }

  return (
    <section className="catalog-content" aria-label={capitalize(noun.plural)}>
      {state.status === 'ready' ? (
        <div className="catalog-kpis" aria-label={`Resumen de ${noun.plural}`}>
          <div>
            <span><small>Total</small><strong>{state.data.total}</strong></span>
            <Stack size={20} aria-hidden="true" />
          </div>
          <div>
            <span><small>Activos en página</small><strong>{activeOnPage}</strong></span>
            <CheckCircle size={20} weight="fill" aria-hidden="true" />
          </div>
          <div>
            <span><small>Inactivos en página</small><strong>{inactiveOnPage}</strong></span>
            <Prohibit size={20} aria-hidden="true" />
          </div>
        </div>
      ) : null}

      <div className="catalog-folder">
        {tabs}
        <div className={`catalog-workspace${showTableView ? ' catalog-workspace--table' : ''}`}>
          <section className="catalog-panel catalog-panel--list" aria-label={`${capitalize(noun.plural)} encontrados`}>
            <div className="catalog-panel__toolbar">
              <SearchInput
                value={search}
                onChange={(value) => { setSearch(value); setPage(1) }}
                onSearch={() => setPage(1)}
                placeholder={searchPlaceholder}
                aria-label={`Buscar ${noun.plural}`}
              />
              <div className="catalog-panel__toolbar-controls">
                <Button
                  variant="secondary"
                  leftIcon={<FunnelSimple />}
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen(true)}
                >
                  Filtros{includeInactive ? ' (1)' : ''}
                </Button>
                <div className="clients-view-switch" aria-label={`Vista de ${noun.plural}`}>
                  <button type="button" aria-pressed={viewMode === 'detail'} onClick={() => setViewMode('detail')}><ListBullets size={15} /> Lista</button>
                  <button type="button" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><Table size={15} /> Tabla</button>
                </div>
              </div>
            </div>

            <p className="catalog-status" role="status">{status}</p>

            {state.status === 'loading' ? (
              <StatePanel state="loading" title={`Cargando ${noun.plural}…`} description="Esto puede tardar unos segundos." />
            ) : state.status === 'error' ? (
              <StatePanel state="error" title={`No se pudieron cargar ${noun.article === 'la' ? 'las' : 'los'} ${noun.plural}`} description={state.message} actionLabel="Reintentar" onAction={reload} />
            ) : state.data.items.length === 0 ? (
              <StatePanel
                state="empty"
                title={q ? 'Sin resultados' : `Todavía no hay ${noun.plural}`}
                description={q ? `Ninguna coincidencia con «${q}».` : `Usá «${newLabel}» para registrar ${noun.article === 'la' ? 'la primera' : 'el primero'} y poder usarl${ending} en los turnos.`}
              />
            ) : (
              <>
                {renderSummary ? renderSummary(state.data) : null}
                {showTableView ? (
                  <div className="clients-table-wrap">
                    <table className="clients-table">
                      <thead>
                        <tr>
                          <th>{capitalize(noun.singular)}</th>
                          <th>Configuración</th>
                          <th>Estado</th>
                          <th aria-label="Acciones" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} data-selected={selectedItem?.id === item.id} onClick={() => selectItem(item)}>
                            <td>
                              <span className="catalog-list-item__icon"><Icon size={16} aria-hidden="true" /></span>
                              <strong>{item.nombre}</strong>
                            </td>
                            <td>{describe(item)}</td>
                            <td>{item.activo ? 'Activo' : 'Inactivo'}</td>
                            <td>
                              <button
                                type="button"
                                className="clients-icon-button"
                                aria-label={`Editar ${item.nombre}`}
                                onClick={(event) => { event.stopPropagation(); setEditing({ item }) }}
                              >
                                <PencilSimple size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ul className="catalog-list">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="catalog-list-item"
                          aria-pressed={selectedItem?.id === item.id}
                          onClick={() => selectItem(item)}
                        >
                          <span className="catalog-list-item__icon"><Icon size={18} weight={selectedItem?.id === item.id ? 'fill' : 'regular'} aria-hidden="true" /></span>
                          <span className="catalog-list-item__body">
                            <strong>{item.nombre}</strong>
                            <small>{describe(item)}</small>
                          </span>
                          {item.activo ? <span className="catalog-list-item__status">Activo</span> : <InactiveBadge />}
                          <span className="catalog-list-item__indicator" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Pager page={state.data.page} pageSize={state.data.pageSize} total={state.data.total} onPageChange={setPage} />
              </>
            )}
          </section>

          {viewMode === 'detail' && !mobileMode ? (
            <aside className="catalog-panel catalog-panel--detail" aria-label={`Detalle ${noun.singular}`}>
          {renderDetail ? renderDetail(selectedItem) : selectedItem ? (
            <div className="catalog-detail">
              <header className="catalog-detail__header">
                <span className="catalog-detail__icon"><Icon size={24} weight="fill" aria-hidden="true" /></span>
                <div>
                  <small>Detalle del {noun.singular}</small>
                  <h2>{selectedItem.nombre}</h2>
                  <span className={selectedItem.activo ? 'catalog-detail__state' : 'catalog-detail__state catalog-detail__state--inactive'}>
                    {selectedItem.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="detail-header-actions">
                  {selectedItem.activo ? (
                    <Button size="sm" variant="danger" leftIcon={<Trash size={15} />} loading={busyId === selectedItem.id} onClick={() => setDeleteTarget(selectedItem)} aria-label={`Eliminar ${selectedItem.nombre}`}>Eliminar {noun.singular}</Button>
                  ) : (
                    <Button size="sm" variant="secondary" leftIcon={<ArrowCounterClockwise size={15} />} loading={busyId === selectedItem.id} onClick={() => void toggle(selectedItem)} aria-label={`Reactivar ${selectedItem.nombre}`}>Reactivar</Button>
                  )}
                  <Button className="detail-edit-button" size="sm" variant="secondary" leftIcon={<PencilSimple size={15} />} onClick={() => setEditing({ item: selectedItem })} aria-label={`Editar ${selectedItem.nombre}`}>Editar</Button>
                </div>
              </header>

              <dl className="catalog-detail__facts">
                <div><dt>Configuración</dt><dd>{describe(selectedItem)}</dd></div>
                <div><dt>Disponibilidad</dt><dd>{selectedItem.activo ? 'Disponible para turnos nuevos' : 'No disponible para turnos nuevos'}</dd></div>
              </dl>

            </div>
          ) : (
            <div className="catalog-detail catalog-detail--empty">
              <Icon size={28} aria-hidden="true" />
              <p>Seleccioná un {noun.singular} para ver su detalle.</p>
            </div>
          )}
            </aside>
          ) : null}
        </div>
      </div>

      {showMobileFab ? (
        <button type="button" className="catalog-fab" onClick={() => setEditing({ item: null })}>
          <Plus size={20} aria-hidden="true" />
          <span>{newLabel}</span>
        </button>
      ) : null}

      <FilterModal
        open={filtersOpen}
        title="Filtros"
        description={`Filtrá ${noun.article === 'la' ? 'las' : 'los'} ${noun.plural} por estado.`}
        onClose={() => setFiltersOpen(false)}
        onClear={() => {
          setIncludeInactive(false)
          setPage(1)
        }}
        onApply={() => setFiltersOpen(false)}
      >
        <label className="catalog-inactive-toggle">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => { setIncludeInactive(event.target.checked); setPage(1) }}
          />
          <span aria-hidden="true" />
          Incluir inactivos
        </label>
      </FilterModal>

      {mobileMode && mobileDetailItem ? (
        <AppModal
          open
          title={mobileDetailItem.nombre}
          onClose={() => setMobileDetailId(null)}
          className="catalog-detail-sheet app-modal--compact-sheet"
          closeLabel={`Cerrar detalle de ${noun.singular}`}
        >
          <div className="catalog-mobile-detail">
            {renderDetail ? renderDetail(mobileDetailItem) : (
              <dl className="catalog-detail__facts">
                <div><dt>Configuración</dt><dd>{describe(mobileDetailItem)}</dd></div>
                <div><dt>Disponibilidad</dt><dd>{mobileDetailItem.activo ? 'Disponible para turnos nuevos' : 'No disponible para turnos nuevos'}</dd></div>
              </dl>
            )}
            <Button
              variant="secondary"
              leftIcon={<ListBullets />}
              onClick={() => setMobileActionsId(mobileDetailItem.id)}
            >
              Acciones
            </Button>
          </div>
        </AppModal>
      ) : null}

      {mobileMode && mobileActionsItem ? (
        <AppModal
          open
          title={`Acciones de ${noun.singular}`}
          description={mobileActionsItem.nombre}
          onClose={() => setMobileActionsId(null)}
          className="catalog-actions-sheet app-modal--compact-sheet"
          closeLabel={`Cerrar acciones de ${noun.singular}`}
        >
          <div className="catalog-actions-sheet__actions">
            <Button
              variant="secondary"
              leftIcon={<PencilSimple />}
              onClick={() => {
                setMobileActionsId(null)
                setEditing({ item: mobileActionsItem })
              }}
            >
              Editar {noun.singular}
            </Button>
            <Button
              variant={mobileActionsItem.activo ? 'danger' : 'secondary'}
              leftIcon={mobileActionsItem.activo ? <Trash /> : <ArrowCounterClockwise />}
              loading={busyId === mobileActionsItem.id}
              onClick={() => {
                const item = mobileActionsItem
                setMobileActionsId(null)
                if (item.activo) setDeleteTarget(item)
                else void toggle(item)
              }}
            >
              {mobileActionsItem.activo ? `Eliminar ${noun.singular}` : `Reactivar ${noun.singular}`}
            </Button>
          </div>
        </AppModal>
      ) : null}

      {editing ? renderForm(editing.item, () => setEditing(null), saved) : null}
      <AppModal
        open={deleteTarget !== null}
        title={`Eliminar ${noun.singular}`}
        description={`${capitalize(noun.article)} ${noun.singular} quedará inactiv${ending} y no podrá seleccionarse en nuevos turnos.`}
        onClose={() => { if (!busyId) setDeleteTarget(null) }}
        className="clients-patient-modal"
        footer={(
          <>
            <Button variant="ghost" disabled={busyId !== null} onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" leftIcon={<Trash />} loading={busyId !== null} loadingText="Eliminando…" onClick={() => { if (deleteTarget) void toggle(deleteTarget) }}>Eliminar {noun.singular}</Button>
          </>
        )}
      >
        {deleteTarget ? <div className="delete-confirmation"><strong>{deleteTarget.nombre}</strong><span>Podrás reactivarl{ending} más adelante desde el filtro de inactivos.</span></div> : null}
      </AppModal>
    </section>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
