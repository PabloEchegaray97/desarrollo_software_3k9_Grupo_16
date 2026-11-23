import { Button } from './Button'

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export function InactiveBadge() {
  return <span className="adm-badge">Inactivo</span>
}

interface PagerProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pager({ page, pageSize, total, onPageChange }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize && page === 1) return null
  return (
    <nav className="adm-pager" aria-label="Paginación">
      <span>Página {page} de {pages} · {total} resultados</span>
      <span className="adm-pager__buttons">
        <Button size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Anterior</Button>
        <Button size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages}>Siguiente</Button>
      </span>
    </nav>
  )
}
