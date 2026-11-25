import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import './app-modal.css'

interface AppModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  closeOnEscape?: boolean
  restoreFocus?: boolean
  id?: string
  className?: string
  closeLabel?: string
  progress?: {
    current: number
    total: number
    label?: string
  }
}

function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
    ),
  ).filter((element) => {
    const style = window.getComputedStyle(element)
    return (
      !element.hidden &&
      element.tabIndex >= 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.closest('[inert], [aria-hidden="true"]') === null
    )
  })
}

export function AppModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  closeOnEscape = true,
  restoreFocus = true,
  id,
  className,
  closeLabel = 'Cerrar modal',
  progress,
}: AppModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const dragStateRef = useRef<{ pointerId: number; startY: number; lastY: number; startTime: number; lastTime: number } | null>(null)
  const dismissTimerRef = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => () => {
    if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current)
  }, [])

  useLayoutEffect(() => {
    const backdrop = backdropRef.current
    if (!open || !backdrop) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdrop)
      .map((element) => ({ element, wasInert: element.hasAttribute('inert') }))
    const previousOverflow = document.body.style.overflow

    background.forEach(({ element }) => {
      element.setAttribute('inert', '')
    })
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const firstFormControl = dialog
      ? getFocusableElements(dialog).find((element) => element.matches('input, select, textarea, [contenteditable="true"]'))
      : undefined
    ;(firstFormControl ?? titleRef.current)?.focus()

    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current)
        dismissTimerRef.current = null
      }
      dragStateRef.current = null
      background.forEach(({ element, wasInert }) => {
        if (!wasInert) element.removeAttribute('inert')
      })
      document.body.style.overflow = previousOverflow

      if (restoreFocus && previouslyFocused?.isConnected && !previouslyFocused.closest('[inert]')) {
        previouslyFocused.focus()
      }
    }
  }, [open, restoreFocus])

  function handleSheetPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!open || isDismissing || dragStateRef.current || !event.isPrimary || !window.matchMedia('(max-width: 48rem)').matches) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const now = performance.now()
    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      startTime: now,
      lastTime: now,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    setIsDragging(true)
    setDragY(0)
  }

  function handleSheetPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const now = performance.now()
    dragStateRef.current = { ...drag, lastY: event.clientY, lastTime: now }
    setDragY(Math.max(event.clientY - drag.startY, 0))
  }

  function endSheetDrag(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragStateRef.current = null
    setIsDragging(false)

    if (cancelled) {
      setDragY(0)
      return
    }

    const now = performance.now()
    const distance = Math.max(event.clientY - drag.startY, 0)
    const segmentDistance = Math.max(event.clientY - drag.lastY, 0)
    const velocity = Math.max(
      segmentDistance / Math.max(now - drag.lastTime, 1),
      distance / Math.max(now - drag.startTime, 1),
    ) * 1000

    if (distance < 96 && velocity < 900) {
      setDragY(0)
      return
    }

    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 180
    setIsDismissing(true)
    setDragY(Math.max(dialogRef.current?.getBoundingClientRect().height ?? 0, 240))
    dismissTimerRef.current = window.setTimeout(() => {
      dismissTimerRef.current = null
      dragStateRef.current = null
      setIsDismissing(false)
      setDragY(0)
      onClose()
    }, duration)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    if (!dialog) return

    const focusableElements = getFocusableElements(dialog)
    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement

    if (!first || !last) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const focusIsOutsideControls =
      activeElement === titleRef.current || activeElement === dialog || !dialog.contains(activeElement)

    if (event.shiftKey && (activeElement === first || focusIsOutsideControls)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (activeElement === last || focusIsOutsideControls)) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!open) return null

  return createPortal(
    <div
      ref={backdropRef}
      className="app-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        id={id}
        className={`app-modal${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={dragY > 0 || isDismissing
          ? {
              transform: `translate3d(0, ${dragY}px, 0)`,
              transition: isDragging ? 'none' : undefined,
            }
          : undefined}
      >
        {progress ? (
          <div
            className="app-modal__progress"
            role="progressbar"
            aria-label={progress.label ?? 'Progreso'}
            aria-valuemin={1}
            aria-valuemax={progress.total}
            aria-valuenow={progress.current}
          >
            <span style={{ width: `${progress.total > 0 ? Math.min(100, Math.max(0, (progress.current / progress.total) * 100)) : 0}%` }} />
          </div>
        ) : null}
        <div
          className="app-modal__handle-zone"
          aria-hidden="true"
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={(event) => endSheetDrag(event, false)}
          onPointerCancel={(event) => endSheetDrag(event, true)}
        >
          <span className="app-modal__handle" />
        </div>
        <header className="app-modal__header">
          <div>
            <h2 ref={titleRef} id={titleId} className="app-modal__title" tabIndex={-1}>
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="app-modal__description">
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" className="app-modal__close" aria-label={closeLabel} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="app-modal__body">{children}</div>
        {footer ? <footer className="app-modal__footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  )
}
