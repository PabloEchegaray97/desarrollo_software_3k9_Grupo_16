import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvailabilityPage } from '.'
import { apiError, mockApi, weeklyResponse, type RecordedRequest } from './test-utils'

type Route = [string, (request: RecordedRequest) => { status: number; body: unknown }]

const configuration = (intervaloGlobalMinutos = 10) => ({
  intervaloGlobalMinutos,
  zonaHoraria: 'America/Argentina/Buenos_Aires',
})

function renderPage(routes: Route[]) {
  const result = mockApi([
    ...routes,
    ['GET /disponibilidad/configuracion', () => ({ status: 200, body: configuration() })],
    ['GET /disponibilidad/semanales', () => ({ status: 200, body: weeklyResponse([]) })],
    ['GET /disponibilidad/excepciones', () => ({ status: 200, body: [] })],
  ])
  render(<AvailabilityPage />)
  return result
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setTime(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('edición de disponibilidad semanal', () => {
  it('muestra la semana como cerrada y el intervalo global actual', async () => {
    renderPage([])
    const schedule = screen.getByRole('region', { name: 'Horario de atención' })

    expect(await within(schedule).findByRole('switch', { name: 'Abrir lunes' })).not.toBeChecked()
    expect(within(schedule).getByRole('switch', { name: 'Abrir domingo' })).not.toBeChecked()
    expect(within(schedule).getByLabelText('Intervalo general')).toHaveValue('10')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('guarda días abiertos, varios tramos y el intervalo general en sus contratos existentes', async () => {
    const { requests } = renderPage([
      ['PUT /disponibilidad/semanales', (request) => ({
        status: 200,
        body: weeklyResponse(request.body && typeof request.body === 'object' && 'tramos' in request.body
          ? request.body.tramos as Array<{ diaSemana: number; horaInicio: string; horaFin: string }>
          : [], 'version-2'),
      })],
      ['PATCH /disponibilidad/configuracion', (request) => ({
        status: 200,
        body: configuration(
          request.body && typeof request.body === 'object' && 'intervaloGlobalMinutos' in request.body
            ? Number(request.body.intervaloGlobalMinutos)
            : 10,
        ),
      })],
    ])
    const user = userEvent.setup()
    const schedule = screen.getByRole('region', { name: 'Horario de atención' })

    await user.click(await within(schedule).findByRole('switch', { name: 'Abrir lunes' }))
    setTime('Inicio lunes, tramo 1', '09:00')
    setTime('Fin lunes, tramo 1', '13:00')
    await user.click(within(schedule).getByTitle('Agregar otro tramo al lunes'))
    setTime('Inicio lunes, tramo 2', '14:00')
    setTime('Fin lunes, tramo 2', '18:00')
    await user.selectOptions(within(schedule).getByLabelText('Intervalo general'), '15')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados correctamente.')
    expect(requests.find((request) => request.method === 'PUT' && request.path === '/disponibilidad/semanales')?.body).toEqual({
      version: 'version-1',
      tramos: [
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        { diaSemana: 1, horaInicio: '14:00', horaFin: '18:00' },
      ],
    })
    expect(requests.find((request) => request.method === 'PATCH' && request.path === '/disponibilidad/configuracion')?.body)
      .toEqual({ intervaloGlobalMinutos: 15 })
  })

  it('conserva los datos y explica el guardado parcial si falla el horario', async () => {
    const { requests } = renderPage([
      ['GET /disponibilidad/semanales', () => ({
        status: 200,
        body: weeklyResponse([{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' }]),
      })],
      ['PUT /disponibilidad/semanales', () => apiError(400, 'WEEKLY_SLOT_OVERLAP', 'El lunes tiene tramos superpuestos.')],
      ['PATCH /disponibilidad/configuracion', () => ({ status: 200, body: configuration(20) })],
    ])
    const user = userEvent.setup()
    const schedule = screen.getByRole('region', { name: 'Horario de atención' })
    await within(schedule).findByDisplayValue('09:00')
    await user.selectOptions(within(schedule).getByLabelText('Intervalo general'), '20')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await within(schedule).findByRole('alert')).toHaveTextContent(
      'Se guardó el intervalo, pero no el horario. El lunes tiene tramos superpuestos.',
    )
    expect(within(schedule).getByDisplayValue('09:00')).toBeInTheDocument()
    expect(within(schedule).getByLabelText('Intervalo general')).toHaveValue('20')
    expect(requests.some((request) => request.method === 'PATCH' && request.path === '/disponibilidad/configuracion')).toBe(true)
  })
})
