import { useCallback, useState, type ReactNode } from 'react'
import { StatePanel } from '../../shared/components/StatePanel'
import type { CatalogListParams } from './types'
import { Button } from './ui/Button'
import { TextField } from './ui/fields'
import { useDebouncedValue, useRemoteList } from './ui/hooks'
import { InactiveBadge, Pager, type Paginated } from './ui/list'

export interface CatalogItem {
  id: string
  nombre: string
  activo: boolean
}

interface CatalogPanelProps<T extends CatalogItem> {
  /** Sustantivos para textos: { singular: 'prestación', plural: 'prestaciones' }. */
  noun: { singular: string; plural: string; article: 'la' | 'el' }
  load: (params: CatalogListParams, signal: AbortSignal) => Promise<Paginated<T>>
  setActive: (id: string, activo: boolean) => Promise<T>
  describe: (item: T) => ReactNode
  renderForm: (item: T | null, close: () => void, saved: (item: T) => void) => ReactNode
  searchPlaceholder?: string
}

const PAGE_SIZE = 20

export function CatalogPanel<T extends CatalogItem>({ noun, load, setActive, describe, renderForm, searchPlaceholder = 'Nombre' }: CatalogPanelProps<T>) {
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<{ item: T | null } | null>(null)
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
    <section className="adm-page" aria-label={capitalize(noun.plural)}>
      <div className="adm-toolbar">
        <div className="adm-toolbar__search">
          <TextField label={`Buscar ${noun.plural}`} type="search" value={search} onValueChange={(value) => { setSearch(value); setPage(1) }} placeholder={searchPlaceholder} autoComplete="off" />
        </div>
        <label className="adm-check">
          <input type="checkbox" checked={includeInactive} onChange={(event) => { setIncludeInactive(event.target.checked); setPage(1) }} />
          Mostrar inactivos
        </label>
        <Button variant="primary" onClick={() => setEditing({ item: null })}>{newLabel}</Button>
      </div>

      <p className="adm-status" role="status">{status}</p>

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
          <ul className="adm-list">
            {state.data.items.map((item) => (
              <li key={item.id} className="adm-row" data-active={item.activo}>
                <div className="adm-row__main">
                  <p className="adm-row__title">{item.nombre} {item.activo ? null : <InactiveBadge />}</p>
                  <p className="adm-row__meta">{describe(item)}</p>
                </div>
                <div className="adm-row__actions">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ item })} aria-label={`Editar ${item.nombre}`}>Editar</Button>
                  <Button size="sm" variant={item.activo ? 'danger' : 'ghost'} loading={busyId === item.id} onClick={() => void toggle(item)} aria-label={`${item.activo ? 'Desactivar' : 'Reactivar'} ${item.nombre}`}>
                    {item.activo ? 'Desactivar' : 'Reactivar'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pager page={state.data.page} pageSize={state.data.pageSize} total={state.data.total} onPageChange={setPage} />
        </>
      )}

      {editing ? renderForm(editing.item, () => setEditing(null), saved) : null}
    </section>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
