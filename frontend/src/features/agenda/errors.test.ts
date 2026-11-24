import { describe, expect, it } from 'vitest'
import { ApiClientError } from '../../shared/api/client'
import { describeAgendaError } from './errors'

describe('describeAgendaError', () => {
  it('un error genérico no expone detalles', () => {
    const problem = describeAgendaError(new Error('boom con datos'))
    expect(problem.kind).toBe('generic')
    expect(problem.message).not.toContain('boom')
  })

  it('distingue rangos rechazados', () => {
    const error = new ApiClientError('x', 400, 'AGENDA_RANGE_INVALID', 'r1')
    expect(describeAgendaError(error)).toMatchObject({ kind: 'range', requestId: 'r1' })
  })
})
