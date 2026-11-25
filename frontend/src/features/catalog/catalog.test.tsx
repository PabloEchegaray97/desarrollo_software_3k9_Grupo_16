import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CatalogPage } from '.'
import { apiError, mockApi, page } from './test-utils'
import type { Chair, Procedure } from './types'

const procedure = (overrides: Partial<Procedure> = {}): Procedure => ({
  id: 'p-1',
  nombre: 'Control ficticio',
  duracionPredeterminadaMinutos: 30,
  intervaloPosteriorMinutos: null,
  activo: true,
  createdAt: '2026-11-24T12:00:00.000Z',
  updatedAt: '2026-11-24T12:00:00.000Z',
  ...overrides,
})

const chair = (overrides: Partial<Chair> = {}): Chair => ({
  id: 'c-1',
  nombre: 'Sillón 1',
  activo: true,
  createdAt: '2026-11-24T12:00:00.000Z',
  updatedAt: '2026-11-24T12:00:00.000Z',
  ...overrides,
})

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderPage(entry = '/prestaciones') {
  return render(<MemoryRouter initialEntries={[entry]}><CatalogPage /><LocationProbe /></MemoryRouter>)
}

// La configuración compartida no habilita `globals`, por lo que RTL no limpia automáticamente.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CatalogPage', () => {
  it('lista prestaciones e indica cuándo usan el intervalo global', async () => {
    mockApi([['GET /prestaciones', () => ({ status: 200, body: page([procedure(), procedure({ id: 'p-2', nombre: 'Limpieza ficticia', intervaloPosteriorMinutos: 5, activo: false })]) })]])
    renderPage()

    expect((await screen.findAllByText('Control ficticio')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('30 min · usa intervalo global').length).toBeGreaterThan(0)
    expect(screen.getByText('30 min · intervalo posterior 5 min')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('cambia a Sillones sin abandonar /prestaciones', async () => {
    const { requests } = mockApi([
      ['GET /prestaciones', () => ({ status: 200, body: page([procedure()]) })],
      ['GET /sillones', () => ({ status: 200, body: page([chair()]) })],
    ])
    renderPage()
    await screen.findAllByText('Control ficticio')

    await userEvent.click(screen.getByRole('tab', { name: 'Sillones' }))

    expect((await screen.findAllByText('Sillón 1')).length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: 'Sillones' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('location')).toHaveTextContent('/prestaciones?seccion=sillones')
    expect(requests.some((request) => request.path.startsWith('/sillones'))).toBe(true)
  })

  it('abre la sección indicada en la URL', async () => {
    mockApi([['GET /sillones', () => ({ status: 200, body: page([chair()]) })]])
    renderPage('/prestaciones?seccion=sillones')
    expect((await screen.findAllByText('Sillón 1')).length).toBeGreaterThan(0)
  })

  it('muestra el estado vacío con acción para crear', async () => {
    mockApi([['GET /sillones', () => ({ status: 200, body: page([]) })]])
    renderPage('/prestaciones?seccion=sillones')

    expect(await screen.findByText('Todavía no hay sillones')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo sillón' }))
    expect(screen.getByRole('dialog', { name: 'Nuevo sillón' })).toBeInTheDocument()
  })

  it('muestra el estado de error con reintento', async () => {
    let calls = 0
    mockApi([['GET /prestaciones', () => (++calls === 1 ? apiError(500, 'INTERNAL_ERROR', 'Unexpected server error') : { status: 200, body: page([procedure()]) })]])
    renderPage()

    expect(await screen.findByText('No se pudieron cargar las prestaciones')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect((await screen.findAllByText('Control ficticio')).length).toBeGreaterThan(0)
  })

  it('muestra junto al campo el error de rango del backend y conserva los valores', async () => {
    const { requests } = mockApi([
      ['GET /prestaciones', () => ({ status: 200, body: page([]) })],
      ['POST /prestaciones', () => apiError(400, 'VALIDATION_ERROR', 'Request validation failed', ['duracionPredeterminadaMinutos must not be greater than 240'])],
    ])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva prestación' }))
    const dialog = screen.getByRole('dialog', { name: 'Nueva prestación' })

    await userEvent.type(within(dialog).getByLabelText(/Nombre/), 'Cirugía ficticia')
    await userEvent.type(within(dialog).getByLabelText(/Duración predeterminada/), '241')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar prestación' }))

    const duration = within(dialog).getByLabelText(/Duración predeterminada/)
    expect(await within(dialog).findByText('La duración debe ser un número entero entre 1 y 240 minutos.')).toBeInTheDocument()
    expect(duration).toHaveAttribute('aria-invalid', 'true')
    expect(duration).toHaveValue('241')
    expect(within(dialog).getByLabelText(/Nombre/)).toHaveValue('Cirugía ficticia')
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      nombre: 'Cirugía ficticia',
      duracionPredeterminadaMinutos: 241,
      intervaloPosteriorMinutos: null,
    })
  })

  it('valida presencia y tipo en el cliente sin llamar al backend', async () => {
    const { requests } = mockApi([['GET /prestaciones', () => ({ status: 200, body: page([]) })]])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva prestación' }))
    const dialog = screen.getByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText(/Duración predeterminada/), 'treinta')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar prestación' }))

    expect(within(dialog).getByText('Ingresá el nombre de la prestación.')).toBeInTheDocument()
    expect(within(dialog).getByText('Ingresá la duración en minutos enteros.')).toBeInTheDocument()
    expect(requests.some((request) => request.method === 'POST')).toBe(false)
  })

  it('muestra el conflicto de nombre junto al campo', async () => {
    mockApi([
      ['GET /sillones', () => ({ status: 200, body: page([chair()]) })],
      ['POST /sillones', () => apiError(409, 'CHAIR_NAME_CONFLICT', 'Ya existe un sillón con ese nombre; si está inactivo, reactivalo')],
    ])
    renderPage('/prestaciones?seccion=sillones')
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo sillón' }))
    const dialog = screen.getByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText(/Nombre/), 'sillón 1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar sillón' }))

    expect(await within(dialog).findByText(/Ya existe un sillón con ese nombre/)).toBeInTheDocument()
  })

  it('desactiva y recarga el listado', async () => {
    let active = true
    const { requests } = mockApi([
      ['GET /sillones', () => ({ status: 200, body: page([chair({ activo: active })]) })],
      ['PATCH /sillones/c-1/estado', () => { active = false; return { status: 200, body: chair({ activo: false }) } }],
    ])
    renderPage('/prestaciones?seccion=sillones')

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Sillón 1' }))
    const dialog = screen.getByRole('dialog', { name: 'Eliminar sillón' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar sillón' }))

    expect(await screen.findByText('Sillón «Sillón 1» desactivado.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Reactivar Sillón 1' })).toBeInTheDocument()
    expect(requests.find((request) => request.method === 'PATCH')?.body).toEqual({ activo: false })
  })
})
