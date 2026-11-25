import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookingConfirmationModal } from './BookingConfirmationModal'

afterEach(cleanup)

describe('BookingConfirmationModal', () => {
  it('muestra el detalle y exige una confirmación explícita', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <BookingConfirmationModal
        open
        patientName="Paciente Ficticio"
        procedureName="Control odontológico"
        chairName="Sillón 1"
        date="2026-11-25"
        time="09:30"
        durationMinutes={45}
        saving={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Confirmar turno' })
    expect(within(dialog).getByText('Paciente Ficticio')).toBeInTheDocument()
    expect(within(dialog).getByText('Control odontológico')).toBeInTheDocument()
    expect(within(dialog).getByText('25/11/2026 · 09:30 hs')).toBeInTheDocument()
    expect(within(dialog).getByText('45 min')).toBeInTheDocument()
    expect(within(dialog).getByText('Sillón 1')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar turno' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('permite volver sin confirmar el turno', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()

    render(
      <BookingConfirmationModal
        open
        patientName="Paciente Ficticio"
        procedureName="Control odontológico"
        chairName="Sillón 1"
        date="2026-11-25"
        time="09:30"
        durationMinutes={30}
        saving={false}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
