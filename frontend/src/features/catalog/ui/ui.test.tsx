import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../../shared/api/client'
import { AdminModal } from './AdminModal'
import { toFormErrors } from './api-errors'
import { TextField } from './fields'

// La configuración compartida no habilita `globals`, por lo que RTL no limpia automáticamente.
afterEach(() => cleanup())

describe('AdminModal', () => {
  it('muestra título y descripción accesibles y cierra con la X', async () => {
    const onClose = vi.fn()
    render(<AdminModal open title="Nuevo sillón" description="Descripción ficticia" onClose={onClose}><p>Contenido</p></AdminModal>)

    const dialog = screen.getByRole('dialog', { name: 'Nuevo sillón' })
    expect(dialog).toHaveAccessibleDescription('Descripción ficticia')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cierra con Esc (evento cancel del dialog nativo)', () => {
    const onClose = vi.fn()
    render(<AdminModal open title="Nueva prestación" onClose={onClose}><p>Contenido</p></AdminModal>)

    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(screen.getByRole('dialog'), cancel)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(cancel.defaultPrevented).toBe(true)
  })

  it('no renderiza contenido cuando está cerrado', () => {
    render(<AdminModal open={false} title="Oculto" onClose={() => undefined}><p>Contenido oculto</p></AdminModal>)
    expect(screen.queryByText('Contenido oculto')).not.toBeInTheDocument()
  })
})

describe('TextField', () => {
  function Harness({ error }: { error?: string }) {
    const [value, setValue] = useState('')
    return <TextField label="Nombre" value={value} onValueChange={setValue} hint="Ayuda ficticia" error={error} />
  }

  it('asocia ayuda y error al input', () => {
    render(<Harness error="Ingresá el nombre." />)
    const input = screen.getByLabelText('Nombre')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Ingresá el nombre. Ayuda ficticia')
  })

  it('sin error no marca el input como inválido', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Nombre')
    await userEvent.type(input, 'Sillón 1')
    expect(input).toHaveValue('Sillón 1')
    expect(input).not.toHaveAttribute('aria-invalid')
  })
})

describe('toFormErrors', () => {
  const mapping = { validation: { nombre: 'Nombre inválido.', duracion: 'Duración inválida.' }, codes: { NAME_CONFLICT: 'nombre' as const } }

  it('ubica errores de validación por prefijo de campo', () => {
    const error = new ApiClientError('Request validation failed', 400, 'VALIDATION_ERROR', 'r', ['duracion must not be greater than 240'])
    expect(toFormErrors(error, mapping)).toEqual({ fields: { duracion: 'Duración inválida.' } })
  })

  it('ubica códigos de dominio junto al campo con el mensaje del backend', () => {
    const error = new ApiClientError('Ya existe', 409, 'NAME_CONFLICT', 'r')
    expect(toFormErrors(error, mapping)).toEqual({ fields: { nombre: 'Ya existe' } })
  })

  it('usa un mensaje genérico para errores de red o del servidor', () => {
    expect(toFormErrors(new TypeError('fetch failed'), mapping).form).toMatch(/No se pudo guardar/)
    expect(toFormErrors(new ApiClientError('Unexpected server error', 500, 'INTERNAL_ERROR', 'r'), mapping).form).toMatch(/No se pudo guardar/)
  })
})
