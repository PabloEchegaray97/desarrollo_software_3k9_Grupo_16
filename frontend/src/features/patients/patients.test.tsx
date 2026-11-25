import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PatientsPage } from '.'
import { apiError, mockApi, page } from '../catalog/test-utils'
import type { Patient } from './types'

const patient = (overrides: Partial<Patient> = {}): Patient => ({
  id: 'pa-1',
  nombre: 'Paciente Ficticio Uno',
  telefono: '11 5555-0001',
  dni: '30000001',
  email: 'uno@example.test',
  activo: true,
  createdAt: '2026-11-24T12:00:00.000Z',
  updatedAt: '2026-11-24T12:00:00.000Z',
  ...overrides,
})

const renderPage = () => render(<MemoryRouter><PatientsPage /></MemoryRouter>)

async function openNewPatientForm() {
  await userEvent.click(await screen.findByRole('button', { name: 'Nuevo paciente' }))
  return screen.getByRole('dialog', { name: 'Nuevo paciente' })
}

async function fillRequired(dialog: HTMLElement, nombre = 'Paciente Ficticio Uno', telefono = '11 5555-0001') {
  await userEvent.type(within(dialog).getByLabelText(/Nombre y apellido/), nombre)
  await userEvent.type(within(dialog).getByLabelText(/Teléfono/), telefono)
}

// La configuración compartida no habilita `globals`, por lo que RTL no limpia automáticamente.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PatientsPage', () => {
  it('usa el documento como dato secundario en la lista de pacientes', async () => {
    mockApi([['GET /pacientes', () => ({ status: 200, body: page([patient(), patient({ id: 'pa-2', nombre: 'Persona Ficticia Sin Dni', dni: null, email: null, activo: false })]) })]])
    renderPage()

    expect(await screen.findByRole('button', { name: /Paciente Ficticio Uno.*30000001/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Persona Ficticia Sin Dni.*DNI no registrado/i })).toBeInTheDocument()
  })

  it('muestra el estado vacío', async () => {
    mockApi([['GET /pacientes', () => ({ status: 200, body: page([]) })]])
    renderPage()
    expect(await screen.findByText('Todavía no hay pacientes')).toBeInTheDocument()
  })

  it('busca con debounce y reinicia la página', async () => {
    const { requests } = mockApi([['GET /pacientes', () => ({ status: 200, body: page([patient()]) })]])
    renderPage()
    await screen.findByText('Paciente Ficticio Uno')

    await userEvent.type(screen.getByLabelText('Buscar pacientes'), '5555-0001')

    await waitFor(() => expect(requests.at(-1)?.path).toBe('/pacientes?q=5555-0001&pageSize=20'))
    expect(requests.filter((request) => request.path.includes('q=')).length).toBe(1)
  })

  it('envía DNI y email vacíos como null', async () => {
    const { requests } = mockApi([
      ['GET /pacientes', () => ({ status: 200, body: page([]) })],
      ['POST /pacientes', () => ({ status: 201, body: patient({ dni: null, email: null }) })],
    ])
    renderPage()
    const dialog = await openNewPatientForm()
    await fillRequired(dialog)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Paciente «Paciente Ficticio Uno» guardado.')).toBeInTheDocument()
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      nombre: 'Paciente Ficticio Uno',
      telefono: '11 5555-0001',
      dni: null,
      email: null,
    })
  })

  it('advierte un posible duplicado y reenvía con confirmación al continuar', async () => {
    let posts = 0
    const { requests } = mockApi([
      ['GET /pacientes', () => ({ status: 200, body: page([]) })],
      ['POST /pacientes', () => (++posts === 1
        ? apiError(409, 'PATIENT_POSSIBLE_DUPLICATE', 'Existe un paciente con el mismo nombre y teléfono', { candidatos: [{ id: 'pa-9', nombre: 'Paciente Ficticio Uno', activo: false }] })
        : { status: 201, body: patient() })],
    ])
    renderPage()
    const dialog = await openNewPatientForm()
    await fillRequired(dialog)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialog).findByText('Posible paciente duplicado')).toBeInTheDocument()
    expect(within(dialog).getByRole('list', { name: 'Pacientes coincidentes' })).toHaveTextContent('Paciente Ficticio Uno (inactivo)')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar de todos modos' }))

    expect(await screen.findByText('Paciente «Paciente Ficticio Uno» guardado.')).toBeInTheDocument()
    const posted = requests.filter((request) => request.method === 'POST').map((request) => request.body)
    expect(posted).toEqual([
      { nombre: 'Paciente Ficticio Uno', telefono: '11 5555-0001', dni: null, email: null },
      { nombre: 'Paciente Ficticio Uno', telefono: '11 5555-0001', dni: null, email: null, confirmarPosibleDuplicado: true },
    ])
  })

  it('al volver a revisar conserva el formulario y no guarda', async () => {
    const { requests } = mockApi([
      ['GET /pacientes', () => ({ status: 200, body: page([]) })],
      ['POST /pacientes', () => apiError(409, 'PATIENT_POSSIBLE_DUPLICATE', 'Posible duplicado')],
    ])
    renderPage()
    const dialog = await openNewPatientForm()
    await fillRequired(dialog)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    // Sin `details.candidatos` (backend previo a CR-01) la advertencia igual se muestra.
    expect(await within(dialog).findByText('Posible paciente duplicado')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Volver a revisar' }))

    expect(within(dialog).queryByText('Posible paciente duplicado')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Nombre y apellido/)).toHaveValue('Paciente Ficticio Uno')
    expect(within(dialog).getByLabelText(/Teléfono/)).toHaveValue('11 5555-0001')
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1)
  })

  it('muestra el DNI repetido junto al campo y conserva los datos', async () => {
    mockApi([
      ['GET /pacientes', () => ({ status: 200, body: page([]) })],
      ['POST /pacientes', () => apiError(409, 'PATIENT_DNI_CONFLICT', 'Ya existe un paciente con ese DNI')],
    ])
    renderPage()
    const dialog = await openNewPatientForm()
    await fillRequired(dialog, 'Otra Persona Ficticia', '11 5555-0009')
    await userEvent.type(within(dialog).getByLabelText(/DNI/), '30.000.001')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    const dni = within(dialog).getByLabelText(/DNI/)
    expect(await within(dialog).findByText('Ya existe un paciente con ese DNI')).toBeInTheDocument()
    expect(dni).toHaveAttribute('aria-invalid', 'true')
    expect(dni).toHaveValue('30.000.001')
    expect(within(dialog).getByLabelText(/Nombre y apellido/)).toHaveValue('Otra Persona Ficticia')
  })

  it('exige nombre y teléfono antes de llamar al backend', async () => {
    const { requests } = mockApi([['GET /pacientes', () => ({ status: 200, body: page([]) })]])
    renderPage()
    const dialog = await openNewPatientForm()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(within(dialog).getByText('Ingresá el nombre del paciente.')).toBeInTheDocument()
    expect(within(dialog).getByText('Ingresá un teléfono de contacto.')).toBeInTheDocument()
    expect(requests.some((request) => request.method === 'POST')).toBe(false)
  })

  it('edita con PUT y precarga los datos', async () => {
    const { requests } = mockApi([
      ['GET /pacientes', () => ({ status: 200, body: page([patient()]) })],
      ['PUT /pacientes/pa-1', () => ({ status: 200, body: patient({ email: 'nuevo@example.test' }) })],
    ])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Paciente Ficticio Uno' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar paciente' })
    expect(within(dialog).getByLabelText(/DNI/)).toHaveValue('30000001')

    const email = within(dialog).getByLabelText(/Email/)
    await userEvent.clear(email)
    await userEvent.type(email, 'nuevo@example.test')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({
      nombre: 'Paciente Ficticio Uno',
      telefono: '11 5555-0001',
      dni: '30000001',
      email: 'nuevo@example.test',
    }))
  })

  it('confirma antes de eliminar un cliente', async () => {
    const { requests } = mockApi([
      ['GET /pacientes', () => ({ status: 200, body: page([patient()]) })],
      ['PATCH /pacientes/pa-1/estado', () => ({ status: 200, body: patient({ activo: false }) })],
    ])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Paciente Ficticio Uno' }))
    expect(requests.some((request) => request.method === 'PATCH')).toBe(false)

    const dialog = screen.getByRole('dialog', { name: 'Eliminar cliente' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar cliente' }))

    expect(await screen.findByText('Paciente «Paciente Ficticio Uno» desactivado.')).toBeInTheDocument()
    expect(requests.find((request) => request.method === 'PATCH')?.body).toEqual({ activo: false })
  })
})
