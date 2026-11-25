import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowsClockwise, DotsThreeVertical, Eye, XCircle } from '@phosphor-icons/react'
import { AppointmentActionSheet } from '../../shared/components/AppointmentActionSheet'
import { StatusBadge } from './StatusBadge'
import { formatLocalTime } from './time'
import type { AgendaTurno } from './types'

interface Props {
  turno: AgendaTurno
  selected: boolean
  onSelect: (turno: AgendaTurno) => void
}

export function AppointmentRow({ turno, selected, onSelect }: Props) {
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const timeRange = `${formatLocalTime(turno.inicio)} - ${formatLocalTime(turno.finAtencion)}`
  const cancelled = turno.estado === 'CANCELADO'
  const terminal = cancelled || turno.estado === 'ATENDIDO' || turno.estado === 'AUSENTE'

  useEffect(() => {
    if (!menuPosition) return

    function closeOnPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuPosition(null)
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setMenuPosition(null)
    }

    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuPosition])

  function openMenu(clientX: number, clientY: number) {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 48rem)').matches) {
      setMenuPosition(null)
      setSheetOpen(true)
      return
    }

    const menuWidth = 224
    const menuHeight = 164
    setMenuPosition({
      left: Math.max(12, Math.min(clientX, window.innerWidth - menuWidth - 12)),
      top: Math.max(12, Math.min(clientY, window.innerHeight - menuHeight - 12)),
    })
  }

  function handleContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault()
    openMenu(event.clientX, event.clientY)
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    openMenu(rect.right - 224, rect.top + 40)
  }

  function runAction(action: 'detail' | 'reschedule' | 'cancel') {
    setMenuPosition(null)
    setSheetOpen(false)
    navigate(`/turnos/${turno.id}`, {
      state: action === 'detail' ? undefined : { dashboardAction: action },
    })
  }

  function handlePrimaryAction() {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 48rem)').matches) {
      setSheetOpen(true)
      return
    }

    onSelect(turno)
  }

  return (
    <li
      className="agenda-row"
      data-status={turno.estado}
      data-selected={selected}
      onContextMenu={handleContextMenu}
      onKeyDown={handleMenuKeyDown}
    >
      <button
        type="button"
        className="agenda-row__button"
        aria-pressed={selected}
        data-turno-id={turno.id}
        onClick={handlePrimaryAction}
      >
        <span className="agenda-row__rail">
          <strong>{cancelled ? <s>{timeRange}</s> : timeRange}</strong>
          <small>Hs</small>
        </span>
        <span className="agenda-row__main">
          <strong>{turno.paciente.nombre}</strong>
          <span>{turno.prestacion.nombre}</span>
          <span className="agenda-row__meta">
            <span>{turno.sillon.nombre}</span>
            <span>{turno.duracionMinutos} min</span>
            {turno.fueraDisponibilidad ? (
              <span className="agenda-row__tag">Fuera de disponibilidad</span>
            ) : null}
          </span>
        </span>
        <span className="agenda-row__marks">
          <StatusBadge estado={turno.estado} />
        </span>
      </button>

      <button
        type="button"
        className="agenda-row__menu-trigger"
        aria-label={`Abrir acciones de ${turno.paciente.nombre}`}
        aria-haspopup="menu"
        aria-expanded={menuPosition !== null || sheetOpen}
        onClick={(event) => {
          event.stopPropagation()
          if (menuPosition) {
            setMenuPosition(null)
            return
          }
          const rect = event.currentTarget.getBoundingClientRect()
          openMenu(rect.right - 224, rect.bottom + 6)
        }}
      >
        <DotsThreeVertical size={18} weight="bold" aria-hidden="true" />
      </button>

      {menuPosition ? (
        <div
          ref={menuRef}
          className="agenda-context-menu"
          role="menu"
          aria-label={`Acciones del turno de ${turno.paciente.nombre}`}
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          <button type="button" role="menuitem" onClick={() => runAction('detail')}>
            <Eye size={20} aria-hidden="true" />
            <span>Ver detalle</span>
          </button>
          <button type="button" role="menuitem" disabled={terminal} onClick={() => runAction('reschedule')}>
            <ArrowsClockwise size={20} aria-hidden="true" />
            <span>Reprogramar</span>
          </button>
          <button type="button" role="menuitem" className="agenda-context-menu__danger" disabled={terminal} onClick={() => runAction('cancel')}>
            <XCircle size={20} aria-hidden="true" />
            <span>Cancelar</span>
          </button>
        </div>
      ) : null}

      <AppointmentActionSheet
        open={sheetOpen}
        patientName={turno.paciente.nombre}
        timeRange={timeRange}
        serviceName={turno.prestacion.nombre}
        terminal={terminal}
        onClose={() => setSheetOpen(false)}
        onDetail={() => runAction('detail')}
        onReschedule={() => runAction('reschedule')}
        onCancel={() => runAction('cancel')}
      />
    </li>
  )
}
