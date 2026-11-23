import { useEffect, useId, useRef, type ReactNode } from 'react'

interface AdminModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/**
 * Modal administrativo con `<dialog>` nativo: foco contenido y cierre con Esc los provee el navegador.
 * Sin animación del shell, según design-system/component-contract.md.
 */
export function AdminModal({ open, title, description, onClose, children, footer }: AdminModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      // jsdom no implementa showModal(); en ese caso se abre como diálogo no modal.
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="adm-modal"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      {open ? (
        <div className="adm-modal__shell">
          <header className="adm-modal__header">
            <div>
              <h2 className="adm-modal__title" id={titleId}>{title}</h2>
              {description ? <p className="adm-modal__description" id={descriptionId}>{description}</p> : null}
            </div>
            <button type="button" className="adm-modal__close" aria-label="Cerrar" onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className="adm-modal__body">{children}</div>
          {footer ? <footer className="adm-modal__footer">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  )
}
