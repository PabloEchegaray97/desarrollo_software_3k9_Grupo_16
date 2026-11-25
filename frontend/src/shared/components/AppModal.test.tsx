import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModal } from './AppModal'

const appModalCss = readFileSync(resolve(process.cwd(), 'src/shared/components/app-modal.css'), 'utf8').replace(/\r\n/g, '\n')

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

function FormModalHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir formulario</button>
      <AppModal open={open} title="Nuevo paciente" onClose={() => setOpen(false)}>
        <label>Nombre<input aria-label="Nombre" /></label>
        <label>DNI<input aria-label="DNI" /></label>
        <label>Correo<input aria-label="Correo" /></label>
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

  it('en formularios enfoca el primer campo y permite recorrer los inputs con Tab', async () => {
    document.documentElement.dataset.theme = theme
    const user = userEvent.setup()
    render(<FormModalHarness />)

    await user.click(screen.getByRole('button', { name: 'Abrir formulario' }))
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('textbox', { name: 'DNI' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Correo' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('textbox', { name: 'DNI' })).toHaveFocus()
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

describe('layout responsive de AppModal', () => {
  it('centra el diálogo en escritorio y usa bottom sheet en móvil sin alterar el drawer', () => {
    expect(appModalCss).toContain('place-items: center;')
    expect(appModalCss).toContain('width: min(46rem, calc(100vw - 32px));')
    expect(appModalCss).toContain('@media (max-width: 48rem)')
    expect(appModalCss).toContain('.app-modal-backdrop {\n    align-items: end;')
    expect(appModalCss).toContain('.app-modal:not(.shell-drawer-panel) {')
    expect(appModalCss).toContain('width: 100%;')
    expect(appModalCss).toContain('border-radius: 1.5rem 1.5rem 0 0;')
    expect(appModalCss).toContain('env(safe-area-inset-bottom)')
  })
})
