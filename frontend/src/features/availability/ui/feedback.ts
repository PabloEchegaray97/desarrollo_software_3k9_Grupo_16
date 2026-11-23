import { ApiClientError } from '../../../shared/api/client'

export type RetryAction = 'reload' | 'save'

export interface Feedback {
  message: string
  retryable: boolean
  retry: RetryAction
  focusFirstField: boolean
}

const NETWORK_MESSAGE = 'No se pudo conectar con el servidor. Reintentá en unos segundos.'

/**
 * Traduce el contrato HTTP común a un mensaje visible. No lee códigos de dominio:
 * el backend es la única fuente del texto y del resultado de la operación.
 */
export function toFeedback(error: unknown, retry: RetryAction): Feedback {
  const fromServer = error instanceof ApiClientError && error.message.trim().length > 0
  return {
    message: fromServer ? error.message : NETWORK_MESSAGE,
    retryable: !fromServer || error.status >= 500 || error.status === 0,
    retry,
    focusFirstField: true,
  }
}
