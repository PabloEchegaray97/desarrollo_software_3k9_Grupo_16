import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModal } from './AppModal'

function ModalHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false)

  function close() {
    onClose()
    setOpen(false)
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir modal
      </button>
      <AppModal
        open={open}
        title="Título del modal"
        description="Descripción del modal"
        onClose={close}
        footer={<button type="button">Guardar</button>}
      >
        <button type="button">Primera acción</button>
        <button type="button">Última acción</button>
      </AppModal>
    </>
  )
}

describe.each(['light', 'dark'] as const)('AppModal en tema %s', (theme) => {
  afterEach(() => {
    cleanup()
    delete document.documentElement.dataset.theme
  })

  it('enfoca el título, vuelve inerte el fondo y bloquea el scroll', async () => {
    document.documentElement.dataset.theme = theme
    document.body.style.overflow = 'auto'
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(<ModalHarness onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Abrir modal' }))

    expect(screen.getByRole('dialog', { name: 'Título del modal' })).toHaveAttribute('aria-modal', 'true')
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Título del modal' }))
    expect(container).toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('mantiene el foco dentro del modal al recorrerlo en ambas direcciones', async () => {
    document.documentElement.dataset.theme = theme
    const user = userEvent.setup()
    render(<ModalHarness onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Abrir modal' }))
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cerrar modal' })).toHaveFocus()

    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Cerrar modal' })).toHaveFocus()
  })

  it('cierra con Escape y restaura el scroll y el foco al disparador', async () => {
    document.documentElement.dataset.theme = theme
    document.body.style.overflow = 'auto'
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(<ModalHarness onClose={onClose} />)
    const trigger = screen.getByRole('button', { name: 'Abrir modal' })

    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(container).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('auto')
    expect(trigger).toHaveFocus()
  })

  it('cierra al activar el backdrop, pero no al activar el contenido', async () => {
    document.documentElement.dataset.theme = theme
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ModalHarness onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Abrir modal' }))
    const dialog = screen.getByRole('dialog', { name: 'Título del modal' })
    const backdrop = dialog.parentElement
    expect(backdrop).not.toBeNull()

    await user.click(dialog)
    expect(onClose).not.toHaveBeenCalled()

    if (backdrop) await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('permite desactivar el cierre con Escape', async () => {
    document.documentElement.dataset.theme = theme
    const user = userEvent.setup()
    const onClose = vi.fn()
    function LockedModal() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Abrir modal</button>
          <AppModal open={open} title="Confirmar" onClose={() => { onClose(); setOpen(false) }} closeOnEscape={false}>
            <button type="button">Continuar</button>
          </AppModal>
        </>
      )
    }
    render(<LockedModal />)

    await user.click(screen.getByRole('button', { name: 'Abrir modal' }))
    await user.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Confirmar' })).toBeInTheDocument()
  })
})
