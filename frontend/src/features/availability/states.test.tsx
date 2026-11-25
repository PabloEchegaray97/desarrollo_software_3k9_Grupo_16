import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvailabilityPage } from '.'
import { weeklyResponse } from './test-utils'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function stubFetch(handler: (path: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(new URL(String(input)).pathname, init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const availabilityCss = readFileSync(resolve(process.cwd(), 'src/features/availability/ui/styles.css'), 'utf8')

describe('estilos de disponibilidad', () => {
  it('usa tokens temáticos y no agrega animaciones decorativas', () => {
    expect(availabilityCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(availabilityCss).not.toMatch(/rgba?\(/)
    expect(availabilityCss).not.toMatch(/transition|animation/)
  })
})

describe('5.5 Estados y accesibilidad', () => {
  it('muestra el estado vacío y permite revelar etiquetas visibles', async () => {
    stubFetch(async (path) => {
      if (path.endsWith('/semanales')) return json(weeklyResponse([]))
      if (path.endsWith('/excepciones')) return json([])
      return json({}, 404)
    })
    render(<AvailabilityPage />)
    const weekly = screen.getByRole('region', { name: 'Horarios semanales' })

    expect(await within(weekly).findByText('Todavía no hay tramos definidos')).toBeInTheDocument()
    await userEvent.click(within(weekly).getByRole('button', { name: 'Agregar primer tramo' }))

    expect(within(weekly).getByLabelText('Día del tramo')).toBeVisible()
    expect(within(weekly).getByLabelText('Inicio del tramo')).toBeVisible()
    expect(within(weekly).getByLabelText('Fin del tramo')).toBeVisible()
    expect(within(screen.getByRole('region', { name: 'Excepciones' })).getByLabelText('Motivo de la excepción')).toBeVisible()
  })

  it('deshabilita el guardado en curso, expone aria-busy y evita duplicar el PUT', async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let puts = 0
    stubFetch(async (path, init) => {
      if (path.endsWith('/semanales') && init?.method === 'PUT') {
        puts += 1
        await gate
        return json(weeklyResponse([{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' }], 'version-2'))
      }
      if (path.endsWith('/semanales')) return json(weeklyResponse([{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' }]))
      if (path.endsWith('/excepciones')) return json([])
      return json({}, 404)
    })
    render(<AvailabilityPage />)
    const weekly = screen.getByRole('region', { name: 'Horarios semanales' })
    await within(weekly).findByDisplayValue('09:00')
    const save = within(weekly).getByRole('button', { name: 'Guardar horarios' })

    await userEvent.click(save)

    expect(within(weekly).getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(within(weekly).getByRole('status')).toHaveTextContent('Guardando horarios…')
    expect(weekly).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(save)
    release()
    expect(await within(weekly).findByText('Horarios guardados correctamente.')).toBeInTheDocument()
    expect(puts).toBe(1)
    expect(weekly).toHaveAttribute('aria-busy', 'false')
  })

  it('muestra un error de red reintentable y conserva los valores', async () => {
    let puts = 0
    stubFetch(async (path, init) => {
      if (path.endsWith('/semanales') && init?.method === 'PUT') {
        puts += 1
        if (puts === 1) throw new TypeError('Failed to fetch')
        return json(weeklyResponse([{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' }], 'version-2'))
      }
      if (path.endsWith('/semanales')) return json(weeklyResponse([{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' }]))
      if (path.endsWith('/excepciones')) return json([])
      return json({}, 404)
    })
    render(<AvailabilityPage />)
    const weekly = screen.getByRole('region', { name: 'Horarios semanales' })
    await within(weekly).findByDisplayValue('09:00')

    await userEvent.click(within(weekly).getByRole('button', { name: 'Guardar horarios' }))

    expect(await within(weekly).findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor. Reintentá en unos segundos.')
    expect(within(weekly).getByDisplayValue('09:00')).toBeInTheDocument()
    await userEvent.click(within(weekly).getByRole('button', { name: 'Reintentar' }))

    expect(await within(weekly).findByRole('status')).toHaveTextContent('Horarios guardados correctamente.')
    expect(puts).toBe(2)
  })

  it('mueve el foco al reintentar cuando falla la carga inicial', async () => {
    stubFetch(async (path) => {
      if (path.endsWith('/semanales')) return json(weeklyResponse([]))
      if (path.endsWith('/excepciones')) throw new TypeError('Failed to fetch')
      return json({}, 404)
    })
    render(<AvailabilityPage />)
    const exceptions = screen.getByRole('region', { name: 'Excepciones' })

    const alert = await within(exceptions).findByRole('alert')
    expect(alert).toHaveTextContent('No se pudo conectar con el servidor. Reintentá en unos segundos.')
    expect(document.activeElement).toBe(within(exceptions).getByRole('button', { name: 'Reintentar' }))
  })
})
