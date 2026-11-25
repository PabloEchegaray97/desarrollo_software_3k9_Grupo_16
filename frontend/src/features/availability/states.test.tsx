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
  it('usa tokens temáticos, transiciones funcionales y respeta movimiento reducido', () => {
    expect(availabilityCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(availabilityCss).not.toMatch(/rgba?\(/)
    expect(availabilityCss).toMatch(/transition/)
    expect(availabilityCss).toMatch(/prefers-reduced-motion: reduce/)
  })
})

describe('5.5 Estados y accesibilidad', () => {
  it('muestra los días cerrados y revela los campos horarios al abrir un día', async () => {
    stubFetch(async (path) => {
      if (path.endsWith('/semanales')) return json(weeklyResponse([]))
      if (path.endsWith('/configuracion')) return json({ intervaloGlobalMinutos: 10, zonaHoraria: 'America/Argentina/Buenos_Aires' })
      if (path.endsWith('/excepciones')) return json([])
      return json({}, 404)
    })
    render(<AvailabilityPage />)
    const weekly = screen.getByRole('region', { name: 'Horario de atención' })

    expect(await within(weekly).findByRole('switch', { name: 'Abrir lunes' })).not.toBeChecked()
    await userEvent.click(within(weekly).getByRole('switch', { name: 'Abrir lunes' }))

    expect(within(weekly).getByLabelText('Inicio lunes, tramo 1')).toBeVisible()
    expect(within(weekly).getByLabelText('Fin lunes, tramo 1')).toBeVisible()
  })

  it('deshabilita el guardado en curso, expone aria-busy y evita duplicar el PUT', async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let puts = 0
    stubFetch(async (path, init) => {
      if (path.endsWith('/configuracion')) return json({ intervaloGlobalMinutos: 10, zonaHoraria: 'America/Argentina/Buenos_Aires' })
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
    const weekly = screen.getByRole('region', { name: 'Horario de atención' })
    await within(weekly).findByDisplayValue('09:00')
    const save = screen.getByRole('button', { name: 'Guardar cambios' })

    await userEvent.click(save)

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(within(weekly).getByRole('status')).toHaveTextContent('Guardando cambios…')
    expect(weekly).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(save)
    release()
    expect(await within(weekly).findByText('Cambios guardados correctamente.')).toBeInTheDocument()
    expect(puts).toBe(1)
    expect(weekly).toHaveAttribute('aria-busy', 'false')
  })

  it('muestra un error de red reintentable y conserva los valores', async () => {
    let puts = 0
    stubFetch(async (path, init) => {
      if (path.endsWith('/configuracion')) return json({ intervaloGlobalMinutos: 10, zonaHoraria: 'America/Argentina/Buenos_Aires' })
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
    const weekly = screen.getByRole('region', { name: 'Horario de atención' })
    await within(weekly).findByDisplayValue('09:00')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await within(weekly).findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor. Reintentá en unos segundos.')
    expect(within(weekly).getByDisplayValue('09:00')).toBeInTheDocument()
    await userEvent.click(within(weekly).getByRole('button', { name: 'Reintentar' }))

    expect(await within(weekly).findByRole('status')).toHaveTextContent('Cambios guardados correctamente.')
    expect(puts).toBe(2)
  })

  it('mueve el foco al reintentar cuando falla la carga inicial', async () => {
    stubFetch(async (path) => {
      if (path.endsWith('/semanales')) throw new TypeError('Failed to fetch')
      if (path.endsWith('/configuracion')) return json({ intervaloGlobalMinutos: 10, zonaHoraria: 'America/Argentina/Buenos_Aires' })
      return json({}, 404)
    })
    render(<AvailabilityPage />)
    const availability = screen.getByRole('region', { name: 'Horario de atención' })

    const alert = await within(availability).findByRole('alert')
    expect(alert).toHaveTextContent('No se pudo conectar con el servidor. Reintentá en unos segundos.')
    expect(document.activeElement).toBe(within(availability).getByRole('button', { name: 'Reintentar' }))
  })
})
