import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from './routes'

describe('AppRoutes', () => {
  it('composes feature routes outside main.tsx', () => {
    render(<MemoryRouter initialEntries={['/pacientes']}><AppRoutes /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Pacientes' })).toBeInTheDocument()
  })
})
