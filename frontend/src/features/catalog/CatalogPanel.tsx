import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  ArrowCounterClockwise,
  CheckCircle,
  FunnelSimple,
  ListBullets,
  PencilSimple,
  Prohibit,
  Stack,
  Table,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
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
  /** Sustantivos visibles para adaptar el panel a servicios o sillones. */
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
}

const PAGE_SIZE = 20

export function CatalogPanel<T extends CatalogItem>({ noun, Icon, load, setActive, describe, renderForm, renderDetail, renderSummary, searchPlaceholder = 'Buscar por nombre', tabs, createRequestKey = 0, onCreateRequestHandled }: CatalogPanelProps<T>) {
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'detail' | 'table'>('detail')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<{ item: T | null } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
  const activeOnPage = items.filter((item) => item.activo).length
  const inactiveOnPage = items.length - activeOnPage

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
      reload()
    } catch {
      setStatus(`No se pudo cambiar el estado de ${noun.article} ${noun.singular}. Intentá de nuevo.`)
    } finally {
      setBusyId(null)
    }
  }

  function saved(item: T) {
    setEditing(null)
    setStatus(`${capitalize(noun.singular)} «${item.nombre}» guardad${ending}.`)
    reload()
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
        <div className={`catalog-workspace${viewMode === 'table' ? ' catalog-workspace--table' : ''}`}>
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
                {viewMode === 'table' ? (
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
                          <tr key={item.id} data-selected={selectedItem?.id === item.id} onClick={() => setSelectedId(item.id)}>
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
                          onClick={() => setSelectedId(item.id)}
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

          {viewMode === 'detail' ? (
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
              </header>

              <dl className="catalog-detail__facts">
                <div><dt>Configuración</dt><dd>{describe(selectedItem)}</dd></div>
                <div><dt>Disponibilidad</dt><dd>{selectedItem.activo ? 'Disponible para turnos nuevos' : 'No disponible para turnos nuevos'}</dd></div>
              </dl>

              <div className="catalog-detail__actions">
                <Button size="sm" variant="primary" leftIcon={<PencilSimple size={15} />} onClick={() => setEditing({ item: selectedItem })} aria-label={`Editar ${selectedItem.nombre}`}>Editar</Button>
                <Button
                  size="sm"
                  variant={selectedItem.activo ? 'secondary' : 'ghost'}
                  leftIcon={selectedItem.activo ? <Prohibit size={15} /> : <ArrowCounterClockwise size={15} />}
                  loading={busyId === selectedItem.id}
                  onClick={() => void toggle(selectedItem)}
                  aria-label={`${selectedItem.activo ? 'Desactivar' : 'Reactivar'} ${selectedItem.nombre}`}
                >
                  {selectedItem.activo ? 'Desactivar' : 'Reactivar'}
                </Button>
              </div>
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

      {editing ? renderForm(editing.item, () => setEditing(null), saved) : null}
    </section>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
