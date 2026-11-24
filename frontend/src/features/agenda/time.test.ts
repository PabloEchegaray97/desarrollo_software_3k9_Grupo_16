import { describe, expect, it } from 'vitest'
import { addDaysToLocalDate, formatLocalRange, formatLocalTime, isValidLocalDate, todayLocal } from './time'

describe('time', () => {
  it('valida fechas civiles reales', () => {
    expect(isValidLocalDate('2027-03-10')).toBe(true)
    expect(isValidLocalDate('2027-02-30')).toBe(false)
    expect(isValidLocalDate('hoy')).toBe(false)
  })

  it('suma días cruzando mes y año', () => {
    expect(addDaysToLocalDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToLocalDate('2027-03-01', -1)).toBe('2027-02-28')
  })

  it('formatea instantes UTC en la zona del consultorio', () => {
    expect(formatLocalTime('2027-03-10T13:00:00.000Z')).toBe('10:00')
    expect(formatLocalRange('2027-03-10T13:00:00.000Z', '2027-03-10T13:40:00.000Z')).toBe('10:00–10:40')
  })

  it('calcula hoy con la zona del consultorio, no la del navegador', () => {
    expect(todayLocal(new Date('2027-03-10T02:00:00.000Z'))).toBe('2027-03-09')
  })
})
