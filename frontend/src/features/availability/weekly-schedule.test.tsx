import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvailabilityPage } from '.'
import { apiError, mockApi, weeklyResponse, type RecordedRequest } from './test-utils'

type Route = [string, (request: RecordedRequest) => { status: number; body: unknown }]

function renderPage(routes: Route[]) {
  const result = mockApi([
    ['GET /disponibilidad/excepciones', () => ({ status: 200, body: [] })],
    ...routes,
  ])
  render(<AvailabilityPage />)
  return result
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setTime(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

describe('5.1 Edición de horarios semanales', () => {
  it('envía dos tramos en un solo PUT y muestra la confirmación', async () => {
    const { requests } = renderPage([
      ['GET /disponibilidad/semanales', () => ({ status: 200, body: weeklyResponse([]) })],
      ['PUT /disponibilidad/semanales', () => ({
        status: 200,
        body: weeklyResponse([
          { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
          { diaSemana: 1, horaInicio: '16:00', horaFin: '20:00' },
        ], 'version-2'),
      })],
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar primer tramo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Agregar tramo' }))

    const dias = screen.getAllByLabelText('Día del tramo')
    const inicios = screen.getAllByLabelText('Inicio del tramo')
    const fines = screen.getAllByLabelText('Fin del tramo')
    expect(dias).toHaveLength(2)
    await userEvent.selectOptions(dias[0], '1')
    await userEvent.selectOptions(dias[1], '1')
    setTime(inicios[0], '09:00')
    setTime(fines[0], '13:00')
    setTime(inicios[1], '16:00')
    setTime(fines[1], '20:00')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar horarios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Horarios guardados correctamente.')
    const puts = requests.filter((request) => request.method === 'PUT')
    expect(puts).toHaveLength(1)
    expect(puts[0].path).toBe('/disponibilidad/semanales')
    expect(puts[0].body).toEqual({
      version: 'version-1',
      tramos: [
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        { diaSemana: 1, horaInicio: '16:00', horaFin: '20:00' },
      ],
    })
  })

  it('muestra el día y el conflicto devueltos y conserva los valores introducidos', async () => {
    const mensaje = 'El lunes tiene tramos que comparten minutos. Revisá el conflicto.'
    const { requests } = renderPage([
      ['GET /disponibilidad/semanales', () => ({
        status: 200,
        body: weeklyResponse([
          { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
          { diaSemana: 1, horaInicio: '16:00', horaFin: '20:00' },
        ]),
      })],
      ['PUT /disponibilidad/semanales', () => apiError(400, 'WEEKLY_SLOT_OVERLAP', mensaje)],
    ])
    expect(await screen.findByDisplayValue('09:00')).toBeInTheDocument()
    const inicios = screen.getAllByLabelText('Inicio del tramo')
    const fines = screen.getAllByLabelText('Fin del tramo')
    setTime(inicios[1], '12:00')
    setTime(fines[1], '17:00')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar horarios' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(mensaje)
    expect(screen.getByDisplayValue('09:00')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12:00')).toBeInTheDocument()
    expect(screen.getByDisplayValue('17:00')).toBeInTheDocument()
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('no bloquea localmente un rango que el backend decide aceptar', async () => {
    renderPage([
      ['GET /disponibilidad/semanales', () => ({
        status: 200,
        body: weeklyResponse([{ diaSemana: 2, horaInicio: '10:00', horaFin: '12:00' }]),
      })],
      ['PUT /disponibilidad/semanales', () => ({
        status: 200,
        body: weeklyResponse([{ diaSemana: 2, horaInicio: '10:00', horaFin: '13:00' }], 'version-2'),
      })],
    ])
    await screen.findByDisplayValue('10:00')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar tramo' }))
    const dias = screen.getAllByLabelText('Día del tramo')
    await userEvent.selectOptions(dias[1], '2')
    setTime(screen.getAllByLabelText('Inicio del tramo')[1], '11:30')
    setTime(screen.getAllByLabelText('Fin del tramo')[1], '13:00')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar horarios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Horarios guardados correctamente.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('quita un tramo antes de guardar y envía solo los restantes', async () => {
    const { requests } = renderPage([
      ['GET /disponibilidad/semanales', () => ({
        status: 200,
        body: weeklyResponse([
          { diaSemana: 3, horaInicio: '09:00', horaFin: '12:00' },
          { diaSemana: 4, horaInicio: '10:00', horaFin: '13:00' },
        ]),
      })],
      ['PUT /disponibilidad/semanales', () => ({ status: 200, body: weeklyResponse([{ diaSemana: 4, horaInicio: '10:00', horaFin: '13:00' }], 'version-2') })],
    ])
    await screen.findByDisplayValue('09:00')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar tramo 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar horarios' }))

    const puts = requests.filter((request) => request.method === 'PUT')
    expect(puts).toHaveLength(1)
    expect(puts[0].body).toEqual({
      version: 'version-1',
      tramos: [{ diaSemana: 4, horaInicio: '10:00', horaFin: '13:00' }],
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Horarios guardados correctamente.')
    expect(within(screen.getByRole('region', { name: 'Horarios semanales' })).getAllByLabelText('Día del tramo')).toHaveLength(1)
  })
})
