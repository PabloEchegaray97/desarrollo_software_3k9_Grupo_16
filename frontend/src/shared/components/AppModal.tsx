import { createPortal } from 'react-dom'
import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import './app-modal.css'

interface AppModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  closeOnEscape?: boolean
  id?: string
  className?: string
  closeLabel?: string
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
  id,
  className,
  closeLabel = 'Cerrar modal',
}: AppModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const descriptionId = useId()

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
    titleRef.current?.focus()

    return () => {
      background.forEach(({ element, wasInert }) => {
        if (!wasInert) element.removeAttribute('inert')
      })
      document.body.style.overflow = previousOverflow

      if (previouslyFocused?.isConnected && !previouslyFocused.closest('[inert]')) {
        previouslyFocused.focus()
      }
    }
  }, [open])

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
      >
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
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="app-modal__body">{children}</div>
        {footer ? <footer className="app-modal__footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  )
}
