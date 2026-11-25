import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExceptionsForm } from './ui/ExceptionsForm'
import { apiError, mockApi, weeklyResponse, type RecordedRequest } from './test-utils'
import type { ExceptionRecord } from './types'

type Route = [string, (request: RecordedRequest) => { status: number; body: unknown }]

const feriado = (overrides: Partial<ExceptionRecord> = {}): ExceptionRecord => ({
  id: 'exc-1',
  fecha: '2026-12-25',
  tipo: 'FERIADO',
  motivo: 'Feriado ficticio',
  horaInicio: null,
  horaFin: null,
  activo: true,
  ...overrides,
})

function renderPage(routes: Route[]) {
  const result = mockApi([
    ['GET /disponibilidad/configuracion', () => ({ status: 200, body: { intervaloGlobalMinutos: 10, zonaHoraria: 'America/Argentina/Buenos_Aires' } })],
    ['GET /disponibilidad/semanales', () => ({ status: 200, body: weeklyResponse([]) })],
    ...routes,
  ])
  render(<ExceptionsForm />)
  return result
}

async function loaded() {
  await within(screen.getByRole('region', { name: 'Excepciones' })).findByText('No hay excepciones activas.')
}

function setDate(value: string) {
  fireEvent.change(screen.getByLabelText('Fecha de la excepción'), { target: { value } })
}

function setTime(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('5.3 Edición de excepciones', () => {
  it('registra un feriado de día completo sin rango horario', async () => {
    const { requests } = renderPage([
      ['GET /disponibilidad/excepciones', () => ({ status: 200, body: [] })],
      ['POST /disponibilidad/excepciones', () => ({ status: 201, body: feriado() })],
    ])
    await loaded()
    const section = screen.getByRole('region', { name: 'Excepciones' })

    setDate('2026-12-25')
    await userEvent.selectOptions(within(section).getByLabelText('Tipo de excepción'), 'FERIADO')
    await userEvent.type(within(section).getByLabelText('Motivo de la excepción'), 'Feriado ficticio')
    await userEvent.click(within(section).getByRole('button', { name: 'Guardar excepción' }))

    expect(await within(section).findByRole('status')).toHaveTextContent(/día completo/)
    const posts = requests.filter((request) => request.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0].body).toEqual({ fecha: '2026-12-25', tipo: 'FERIADO', motivo: 'Feriado ficticio' })
    expect(within(section).getByText('Feriado ficticio')).toBeInTheDocument()
  })

  it('registra un bloqueo parcial con inicio y fin', async () => {
    const bloqueo = feriado({ id: 'exc-2', fecha: '2026-07-15', tipo: 'BLOQUEO', motivo: 'Mantenimiento ficticio', horaInicio: '11:00', horaFin: '12:30' })
    const { requests } = renderPage([
      ['GET /disponibilidad/excepciones', () => ({ status: 200, body: [] })],
      ['POST /disponibilidad/excepciones', () => ({ status: 201, body: bloqueo })],
    ])
    await loaded()
    const section = screen.getByRole('region', { name: 'Excepciones' })

    setDate('2026-07-15')
    await userEvent.selectOptions(within(section).getByLabelText('Tipo de excepción'), 'BLOQUEO')
    await userEvent.click(within(section).getByLabelText('Tramo parcial'))
    setTime('Inicio del bloqueo', '11:00')
    setTime('Fin del bloqueo', '12:30')
    await userEvent.type(within(section).getByLabelText('Motivo de la excepción'), 'Mantenimiento ficticio')
    await userEvent.click(within(section).getByRole('button', { name: 'Guardar excepción' }))

    expect(await within(section).findByRole('status')).toHaveTextContent('11:00–12:30')
    const posts = requests.filter((request) => request.method === 'POST')
    expect(posts[0].body).toEqual({
      fecha: '2026-07-15',
      tipo: 'BLOQUEO',
      motivo: 'Mantenimiento ficticio',
      horaInicio: '11:00',
      horaFin: '12:30',
    })
    expect(within(section).getByText('Mantenimiento ficticio')).toBeInTheDocument()
  })

  it('no envía cuando el motivo está vacío y marca el campo inválido', async () => {
    const { requests } = renderPage([
      ['GET /disponibilidad/excepciones', () => ({ status: 200, body: [] })],
    ])
    await loaded()
    const section = screen.getByRole('region', { name: 'Excepciones' })

    setDate('2026-12-25')
    await userEvent.click(within(section).getByRole('button', { name: 'Guardar excepción' }))

    expect(requests.some((request) => request.method === 'POST')).toBe(false)
    const motivo = within(section).getByLabelText('Motivo de la excepción')
    expect(motivo).toHaveAttribute('aria-invalid', 'true')
    expect(await within(section).findByText('El motivo es obligatorio.')).toBeInTheDocument()
  })

  it('muestra el error del backend y conserva los datos introducidos', async () => {
    const mensaje = 'La fecha ya tiene una excepción activa. Revisá el motivo.'
    const { requests } = renderPage([
      ['GET /disponibilidad/excepciones', () => ({ status: 200, body: [] })],
      ['POST /disponibilidad/excepciones', () => apiError(400, 'VALIDATION_ERROR', mensaje)],
    ])
    await loaded()
    const section = screen.getByRole('region', { name: 'Excepciones' })

    setDate('2026-12-25')
    await userEvent.type(within(section).getByLabelText('Motivo de la excepción'), 'Feriado ficticio')
    await userEvent.click(within(section).getByRole('button', { name: 'Guardar excepción' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent(mensaje)
    expect(within(section).getByLabelText('Motivo de la excepción')).toHaveValue('Feriado ficticio')
    expect(within(section).getByLabelText('Fecha de la excepción')).toHaveValue('2026-12-25')
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1)
  })

  it('cancela con baja lógica y oculta la excepción de la lista activa', async () => {
    const { requests } = renderPage([
      ['GET /disponibilidad/excepciones', () => ({ status: 200, body: [feriado()] })],
      ['PATCH /disponibilidad/excepciones/exc-1', () => ({ status: 200, body: feriado({ activo: false }) })],
    ])
    const section = screen.getByRole('region', { name: 'Excepciones' })
    expect(await within(section).findByText('Feriado ficticio')).toBeInTheDocument()

    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar excepción Feriado ficticio' }))

    const patches = requests.filter((request) => request.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].path).toBe('/disponibilidad/excepciones/exc-1')
    expect(patches[0].body).toEqual({ activo: false })
    await waitFor(() => expect(within(section).queryByText('Feriado ficticio')).not.toBeInTheDocument())
    expect(within(section).getByRole('status')).toHaveTextContent('inactiva')
  })

  it('conserva la excepción en la lista si falla la baja lógica', async () => {
    const { requests } = renderPage([
      ['GET /disponibilidad/excepciones', () => ({ status: 200, body: [feriado()] })],
      ['PATCH /disponibilidad/excepciones/exc-1', () => apiError(500, 'HTTP_500', 'No se pudo cancelar. Intentá de nuevo.')],
    ])
    const section = screen.getByRole('region', { name: 'Excepciones' })
    expect(await within(section).findByText('Feriado ficticio')).toBeInTheDocument()

    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar excepción Feriado ficticio' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent('No se pudo cancelar. Intentá de nuevo.')
    expect(within(section).getByText('Feriado ficticio')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(requests.filter((request) => request.method === 'PATCH')).toHaveLength(1)
  })
})
