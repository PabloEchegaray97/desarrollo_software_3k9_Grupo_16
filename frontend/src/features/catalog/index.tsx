import { useCallback, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { chairsApi, proceduresApi } from './api'
import { CatalogPanel } from './CatalogPanel'
import { ChairForm } from './ChairForm'
import { ProcedureForm } from './ProcedureForm'
import type { CatalogListParams, CatalogSection, Chair, Procedure } from './types'
import './ui/admin-ui.css'

const SECTIONS: ReadonlyArray<{ id: CatalogSection; label: string }> = [
  { id: 'prestaciones', label: 'Prestaciones' },
  { id: 'sillones', label: 'Sillones' },
]

export function describeProcedure(procedure: Procedure): string {
  const interval = procedure.intervaloPosteriorMinutos === null
    ? 'usa intervalo global'
    : `intervalo posterior ${procedure.intervaloPosteriorMinutos} min`
  return `${procedure.duracionPredeterminadaMinutos} min · ${interval}`
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const section: CatalogSection = searchParams.get('seccion') === 'sillones' ? 'sillones' : 'prestaciones'

  const selectSection = (next: CatalogSection) => {
    setSearchParams(next === 'prestaciones' ? {} : { seccion: next }, { replace: true })
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = section === 'prestaciones' ? 'sillones' : 'prestaciones'
    selectSection(next)
    document.getElementById(`catalog-tab-${next}`)?.focus()
  }

  const loadProcedures = useCallback((params: CatalogListParams, signal: AbortSignal) => proceduresApi.list(params, signal), [])
  const loadChairs = useCallback((params: CatalogListParams, signal: AbortSignal) => chairsApi.list(params, signal), [])

  return (
    <section className="adm-page">
      <header className="adm-page__header">
        <div>
          <h1 className="page-heading">Prestaciones y sillones</h1>
          <p className="page-lead">Definí las prestaciones con su duración e intervalo, y los sillones del consultorio.</p>
        </div>
      </header>

      <div className="adm-tabs" role="tablist" aria-label="Secciones del catálogo">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            id={`catalog-tab-${item.id}`}
            type="button"
            role="tab"
            className="adm-tab"
            aria-selected={section === item.id}
            aria-controls={`catalog-panel-${item.id}`}
            tabIndex={section === item.id ? 0 : -1}
            onClick={() => selectSection(item.id)}
            onKeyDown={onTabKeyDown}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`catalog-panel-${section}`} aria-labelledby={`catalog-tab-${section}`}>
        {section === 'prestaciones' ? (
          <CatalogPanel<Procedure>
            key="prestaciones"
            noun={{ singular: 'prestación', plural: 'prestaciones', article: 'la' }}
            load={loadProcedures}
            setActive={proceduresApi.setActive}
            describe={describeProcedure}
            renderForm={(item, close, saved) => <ProcedureForm procedure={item} onClose={close} onSaved={saved} />}
          />
        ) : (
          <CatalogPanel<Chair>
            key="sillones"
            noun={{ singular: 'sillón', plural: 'sillones', article: 'el' }}
            load={loadChairs}
            setActive={chairsApi.setActive}
            describe={(chair) => (chair.activo ? 'Disponible para turnos nuevos' : 'No se ofrece para turnos nuevos')}
            renderForm={(item, close, saved) => <ChairForm chair={item} onClose={close} onSaved={saved} />}
          />
        )}
      </div>
    </section>
  )
}
