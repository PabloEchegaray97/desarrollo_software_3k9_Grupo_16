import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StatePanel } from './StatePanel'

describe('StatePanel', () => {
  it.each(['loading', 'empty', 'error'] as const)('renders the %s state', (state) => {
    render(<StatePanel state={state} title={`${state} title`} description="Detalle" />)
    expect(screen.getByText(`${state} title`)).toBeInTheDocument()
  })

  it('runs an available action', async () => {
    const onAction = vi.fn()
    render(<StatePanel state="error" title="Error" description="Detalle" actionLabel="Reintentar" onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onAction).toHaveBeenCalledOnce()
  })
})
