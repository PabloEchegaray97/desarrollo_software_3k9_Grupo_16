import { describe, expect, it } from 'vitest'
import { STATUS_PRESENTATION, blockTypeLabel } from './status'
import { APPOINTMENT_STATUSES } from './types'

describe('status', () => {
  it('cada estado tiene texto y una forma distinta', () => {
    const shapes = APPOINTMENT_STATUSES.map((s) => STATUS_PRESENTATION[s].shape)
    expect(new Set(shapes).size).toBe(APPOINTMENT_STATUSES.length)
    APPOINTMENT_STATUSES.forEach((s) => expect(STATUS_PRESENTATION[s].label).toBeTruthy())
  })

  it('traduce tipos de bloqueo y deja pasar los desconocidos', () => {
    expect(blockTypeLabel('FERIADO')).toBe('Feriado')
    expect(blockTypeLabel('OTRO')).toBe('OTRO')
  })
})
