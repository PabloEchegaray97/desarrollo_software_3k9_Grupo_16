import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import {
  ArrowCounterClockwise,
  CalendarCheck,
  CalendarDots,
  Clock,
  ClockCounterClockwise,
  FloppyDisk,
  Leaf,
  Plus,
  Prohibit,
  Trash,
} from '@phosphor-icons/react'
import { sileo } from 'sileo'
import { AppButton } from '../../../shared/components/Button'
import { AppModal } from '../../../shared/components/AppModal'
import { PremiumCalendar } from '../../../shared/components/PremiumCalendar'
import { StatePanel } from '../../../shared/components/StatePanel'
import { cancelException, createException, getExceptions } from '../api'
import type { ExceptionCreateInput, ExceptionRecord } from '../types'
import './blocks.css'

type Coverage = 'full-day' | 'partial'
type LoadStatus = 'loading' | 'ready' | 'error'

interface BlockDraft {
  fecha: string
  motivo: string
  cobertura: Coverage
  horaInicio: string
  horaFin: string
}

interface BlockEditorProps {
  draft: BlockDraft
  error: string
  saving: boolean
  onChange: (draft: BlockDraft) => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localToday(): string {
  return localDateKey(new Date())
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function emptyDraft(date: string): BlockDraft {
  return { fecha: date, motivo: '', cobertura: 'full-day', horaInicio: '09:00', horaFin: '12:00' }
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseLocalDate(value))
}

function formatNumericDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function sortBlocks(records: ExceptionRecord[]): ExceptionRecord[] {
  return [...records].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio ?? '').localeCompare(b.horaInicio ?? ''))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado. Intentá nuevamente.'
}

function openNativePicker(event: MouseEvent<HTMLInputElement>) {
  if (event.currentTarget.disabled || typeof event.currentTarget.showPicker !== 'function') return
  try {
    event.currentTarget.showPicker()
  } catch {
    // El selector nativo puede rechazar aperturas duplicadas; el input conserva su comportamiento normal.
  }
}

function BlockEditor({ draft, error, saving, onChange, onSave }: BlockEditorProps) {
  return (
    <form id="block-editor-form" className="blocks-editor" onSubmit={onSave}>
      <fieldset className="blocks-editor__types" disabled={saving}>
        <legend>Tipo de bloqueo</legend>
        <div>
          <button type="button" aria-pressed={draft.cobertura === 'full-day'} onClick={() => onChange({ ...draft, cobertura: 'full-day' })}>
            <Prohibit size={15} /> Día completo
          </button>
          <button type="button" aria-pressed={draft.cobertura === 'partial'} onClick={() => onChange({ ...draft, cobertura: 'partial' })}>
            <Clock size={15} /> Parcial
          </button>
        </div>
      </fieldset>

      <div className="app-field">
        <label className="app-field__label" htmlFor="block-date">Fecha</label>
        <input id="block-date" className="app-control" type="date" required value={draft.fecha} disabled={saving} onClick={openNativePicker} onChange={(event) => onChange({ ...draft, fecha: event.target.value })} />
      </div>

      {draft.cobertura === 'partial' ? (
        <div className="blocks-editor__times">
          <div className="app-field">
            <label className="app-field__label" htmlFor="block-start">Horario inicio</label>
            <input id="block-start" className="app-control" type="time" required value={draft.horaInicio} disabled={saving} onClick={openNativePicker} onChange={(event) => onChange({ ...draft, horaInicio: event.target.value })} />
          </div>
          <div className="app-field">
            <label className="app-field__label" htmlFor="block-end">Horario fin</label>
            <input id="block-end" className="app-control" type="time" required value={draft.horaFin} disabled={saving} onClick={openNativePicker} onChange={(event) => onChange({ ...draft, horaFin: event.target.value })} />
          </div>
        </div>
      ) : null}

      <div className="app-field">
        <label className="app-field__label" htmlFor="block-reason">Motivo</label>
        <textarea id="block-reason" className="app-control app-control--textarea" rows={3} maxLength={240} required placeholder="Ej: Feriado, capacitación interna, evento…" value={draft.motivo} disabled={saving} onChange={(event) => onChange({ ...draft, motivo: event.target.value })} />
      </div>

      {error ? <p className="blocks-editor__error" role="alert">{error}</p> : null}
    </form>
  )
}

export function BlocksPage() {
  const today = useMemo(localToday, [])
  const [blocks, setBlocks] = useState<ExceptionRecord[]>([])
  const [selectedDate, setSelectedDate] = useState(today)
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7))
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<BlockDraft>(() => emptyDraft(today))
  const [createError, setCreateError] = useState('')
  const [saving, setSaving] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<ExceptionRecord | null>(null)
  const [cancelError, setCancelError] = useState('')
  const [canceling, setCanceling] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoadStatus('loading')
    setLoadError('')
    void getExceptions(controller.signal)
      .then((response) => {
        setBlocks(sortBlocks(response.filter((record) => record.activo && record.tipo === 'BLOQUEO')))
        setLoadStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(errorMessage(error))
        setLoadStatus('error')
      })
    return () => controller.abort()
  }, [reloadKey])

  const blockCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    blocks.forEach((block) => { counts[block.fecha] = (counts[block.fecha] ?? 0) + 1 })
    return counts
  }, [blocks])

  const selectedBlocks = useMemo(() => blocks.filter((block) => block.fecha === selectedDate), [blocks, selectedDate])
  const metrics = useMemo(() => ({
    today: blocks.filter((block) => block.fecha === today).length,
    active: blocks.filter((block) => block.fecha >= today).length,
    past: blocks.filter((block) => block.fecha < today).length,
  }), [blocks, today])

  function selectDate(date: string) {
    setSelectedDate(date)
    setVisibleMonth(date.slice(0, 7))
    setDraft(emptyDraft(date))
    setCreateError('')
  }

  function openEditor() {
    setDraft(emptyDraft(selectedDate))
    setCreateError('')
    setEditorOpen(true)
  }

  function clearEditor() {
    setDraft(emptyDraft(selectedDate))
    setCreateError('')
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const motivo = draft.motivo.trim()
    if (!motivo) {
      setCreateError('Ingresá un motivo para el bloqueo.')
      return
    }
    if (draft.cobertura === 'partial' && (!draft.horaInicio || !draft.horaFin || draft.horaInicio >= draft.horaFin)) {
      setCreateError('Ingresá un tramo horario válido. El fin debe ser posterior al inicio.')
      return
    }

    const input: ExceptionCreateInput = {
      fecha: draft.fecha,
      tipo: 'BLOQUEO',
      motivo,
      ...(draft.cobertura === 'partial' ? { horaInicio: draft.horaInicio, horaFin: draft.horaFin } : {}),
    }

    setSaving(true)
    setCreateError('')
    try {
      const created = await createException(input)
      setBlocks((current) => sortBlocks([...current.filter((record) => record.id !== created.id), created]))
      setSelectedDate(created.fecha)
      setVisibleMonth(created.fecha.slice(0, 7))
      setDraft(emptyDraft(created.fecha))
      setEditorOpen(false)
      sileo.success({ title: 'Bloqueo guardado', description: `${formatLongDate(created.fecha)} · ${created.horaInicio && created.horaFin ? `${created.horaInicio}–${created.horaFin}` : 'Día completo'}` })
    } catch (error: unknown) {
      setCreateError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function confirmCancel() {
    if (!cancelTarget || canceling) return
    setCanceling(true)
    setCancelError('')
    try {
      await cancelException(cancelTarget.id)
      setBlocks((current) => current.filter((record) => record.id !== cancelTarget.id))
      setCancelTarget(null)
      sileo.success({ title: 'Bloqueo eliminado', description: 'La fecha volvió a estar disponible.' })
    } catch (error: unknown) {
      setCancelError(errorMessage(error))
    } finally {
      setCanceling(false)
    }
  }

  return (
    <main className="blocks-page">
      <header className="blocks-page__header">
        <div><h1 className="page-heading">Bloqueos</h1><p className="page-lead">Bloqueá días completos o franjas horarias para evitar nuevos turnos.</p></div>
        <AppButton className="blocks-page__create" variant="primary" leftIcon={<Plus size={16} />} disabled={loadStatus !== 'ready'} onClick={openEditor}>Nuevo bloqueo</AppButton>
      </header>

      <section className="blocks-kpis" aria-label="Resumen de bloqueos">
        <div><span><small>Hoy</small><strong>{loadStatus === 'ready' ? metrics.today : '—'}</strong></span><CalendarDots size={20} aria-hidden="true" /></div>
        <div><span><small>Activos</small><strong>{loadStatus === 'ready' ? metrics.active : '—'}</strong></span><CalendarCheck size={20} aria-hidden="true" /></div>
        <div><span><small>Pasados</small><strong>{loadStatus === 'ready' ? metrics.past : '—'}</strong></span><ClockCounterClockwise size={20} aria-hidden="true" /></div>
      </section>

      {loadStatus === 'loading' ? (
        <StatePanel state="loading" title="Cargando bloqueos" description="Estamos consultando los bloqueos activos." />
      ) : loadStatus === 'error' ? (
        <StatePanel state="error" title="No se pudieron cargar los bloqueos" description={loadError} actionLabel="Reintentar" onAction={() => setReloadKey((current) => current + 1)} />
      ) : (
        <>
          <div className="blocks-workspace">
            <div className="blocks-calendar-column">
              <div className="blocks-calendar-surface">
                <PremiumCalendar
                  selectedDate={selectedDate}
                  onDateSelect={selectDate}
                  visibleMonth={visibleMonth}
                  onVisibleMonthChange={setVisibleMonth}
                  todayDate={today}
                  compact
                  showShell={false}
                  eventCountByDate={blockCounts}
                />
              </div>
            </div>

            <aside className="blocks-selected-panel">
              <header>
                <div>
                  <h2>Bloqueos para el {formatLongDate(selectedDate)}</h2>
                  <p>{selectedBlocks.length === 0 ? 'No hay bloqueos activos para esta fecha.' : `${selectedBlocks.length === 1 ? '1 bloqueo activo' : `${selectedBlocks.length} bloqueos activos`} para esta fecha.`}</p>
                </div>
              </header>
              {selectedBlocks.length === 0 ? (
                <div className="blocks-selected-empty">
                  <Leaf size={21} weight="fill" aria-hidden="true" />
                  <strong>Sin bloqueos para esta fecha</strong>
                  <AppButton size="sm" variant="primary" leftIcon={<Plus size={15} />} onClick={openEditor}>
                    Crear para {formatNumericDate(selectedDate)}
                  </AppButton>
                </div>
              ) : (
                <ul className="blocks-selected-list">
                  {selectedBlocks.map((block) => <BlockCard key={block.id} block={block} onDelete={() => { setCancelTarget(block); setCancelError('') }} />)}
                </ul>
              )}
            </aside>
          </div>
        </>
      )}

      {loadStatus === 'ready' ? <AppButton className="blocks-fab" size="lg" variant="primary" leftIcon={<Plus />} onClick={openEditor}>Nuevo bloqueo</AppButton> : null}

      <AppModal
        open={editorOpen}
        title="Nuevo bloqueo"
        description="Definí la fecha y el alcance del bloqueo."
        onClose={() => { if (!saving) setEditorOpen(false) }}
        className="clients-patient-modal blocks-editor-modal"
        footer={(
          <>
            <AppButton className="blocks-modal__cancel" type="button" variant="ghost" disabled={saving} onClick={() => setEditorOpen(false)}>Cancelar</AppButton>
            <AppButton type="button" variant="secondary" leftIcon={<ArrowCounterClockwise />} disabled={saving} onClick={clearEditor}>Limpiar</AppButton>
            <AppButton className="clients-modal__save" type="submit" form="block-editor-form" variant="primary" leftIcon={<FloppyDisk />} loading={saving} loadingText="Guardando…">Guardar bloqueo</AppButton>
          </>
        )}
      >
        <BlockEditor draft={draft} error={createError} saving={saving} onChange={(next) => { setDraft(next); setCreateError('') }} onSave={(event) => void submitCreate(event)} />
      </AppModal>

      <AppModal
        open={cancelTarget !== null}
        title="Eliminar bloqueo"
        onClose={() => { if (!canceling) setCancelTarget(null) }}
        className="clients-patient-modal blocks-delete-modal"
        footer={
          <>
            <AppButton className="blocks-modal__cancel" variant="ghost" disabled={canceling} onClick={() => setCancelTarget(null)}>Cancelar</AppButton>
            <AppButton variant="danger" leftIcon={<Trash />} loading={canceling} loadingText="Eliminando…" onClick={() => void confirmCancel()}>Eliminar bloqueo</AppButton>
          </>
        }
      >
        {cancelTarget ? (
          <div className="blocks-delete-confirmation">
            <strong>{cancelTarget.motivo}</strong>
            <span>{formatLongDate(cancelTarget.fecha)} · {cancelTarget.horaInicio && cancelTarget.horaFin ? `${cancelTarget.horaInicio}–${cancelTarget.horaFin}` : 'Día completo'}</span>
            {cancelError ? <p role="alert">{cancelError}</p> : null}
          </div>
        ) : null}
      </AppModal>
    </main>
  )
}

function BlockCard({ block, onDelete }: { block: ExceptionRecord; onDelete: () => void }) {
  const partial = Boolean(block.horaInicio && block.horaFin)
  return (
    <li className="blocks-record">
      <div className="blocks-record__main">
        <span className="blocks-record__rail">
          <strong>{formatNumericDate(block.fecha)}</strong>
        </span>
        <span className="blocks-record__body">
          <strong>{block.motivo}</strong>
          {partial ? <span className="blocks-record__time">{block.horaInicio} - {block.horaFin} Hs</span> : null}
          <span className="blocks-record__meta">
            <span className={`blocks-record__badge${partial ? ' blocks-record__badge--partial' : ''}`}>
              {partial ? 'Horario parcial' : 'Día completo'}
            </span>
          </span>
        </span>
      </div>
      <AppButton size="sm" variant="danger" leftIcon={<Trash />} onClick={onDelete}>Eliminar</AppButton>
    </li>
  )
}
