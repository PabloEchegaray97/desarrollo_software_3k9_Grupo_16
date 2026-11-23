import { ApiClientError } from '../../../shared/api/client'
import { describe, expect, it } from 'vitest'
import { toFeedback } from './feedback'

const MENSAJE = 'El lunes tiene tramos que comparten minutos. Revisá el conflicto.'

describe('5.5/5.6 Mensajes seguros del backend', () => {
  it.each(['WEEKLY_SLOT_OVERLAP', 'VALIDATION_ERROR', 'HTTP_400'])(
    'muestra el mismo mensaje con el código %s sin reaccionar por él',
    (code) => {
      const error = new ApiClientError(MENSAJE, 400, code, 'request-test')
      expect(toFeedback(error, 'save')).toEqual({
        message: MENSAJE,
        retryable: false,
        retry: 'save',
        focusFirstField: true,
      })
    },
  )

  it('marca como reintentable un error de red sin mensaje del backend', () => {
    expect(toFeedback(new TypeError('Failed to fetch'), 'reload')).toEqual({
      message: 'No se pudo conectar con el servidor. Reintentá en unos segundos.',
      retryable: true,
      retry: 'reload',
      focusFirstField: true,
    })
  })
})
