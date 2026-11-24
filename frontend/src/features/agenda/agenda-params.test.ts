import { describe, expect, it } from 'vitest'
import { readViewState, toAgendaQuery, writeViewState } from './agenda-params'

const TODAY = '2027-03-10'

describe('agenda-params', () => {
  it('sin parámetros usa hoy y todos los estados', () => {
    const state = readViewState(new URLSearchParams(), TODAY)
    expect(state.fecha).toBe(TODAY)
    expect(state.estados).toHaveLength(5)
    expect(toAgendaQuery(state)).toEqual({ desde: TODAY })
  })

  it('una fecha inválida vuelve a hoy', () => {
    expect(readViewState(new URLSearchParams('fecha=2027-02-30'), TODAY).fecha).toBe(TODAY)
  })

  it('lee estados, descarta desconocidos y soporta ninguno', () => {
    expect(readViewState(new URLSearchParams('estado=CONFIRMADO,XX'), TODAY).estados).toEqual(['CONFIRMADO'])
    expect(readViewState(new URLSearchParams('estado=XX'), TODAY).estados).toHaveLength(5)
    const none = readViewState(new URLSearchParams('estado=ninguno'), TODAY)
    expect(none.estados).toEqual([])
    expect(toAgendaQuery(none)).toBeNull()
  })

  it('escribe solo lo que difiere de los valores por defecto y es reversible', () => {
    expect(writeViewState(readViewState(new URLSearchParams(), TODAY), TODAY).toString()).toBe('')
    const state = readViewState(new URLSearchParams('fecha=2027-03-11&sillon=s1&estado=AUSENTE&turno=t1'), TODAY)
    const written = writeViewState(state, TODAY)
    expect(readViewState(written, TODAY)).toEqual(state)
  })
})
