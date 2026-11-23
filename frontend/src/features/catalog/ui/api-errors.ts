import { ApiClientError } from '../../../shared/api/client'

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>

export interface FormErrors<Field extends string> {
  fields: FieldErrors<Field>
  form?: string
}

interface ErrorMapping<Field extends string> {
  /** Mensaje en español por campo cuando el backend lo marca en `VALIDATION_ERROR`. */
  validation: Record<Field, string>
  /** Códigos de dominio que se muestran junto a un campo. */
  codes?: Partial<Record<string, Field>>
}

const GENERIC_ERROR = 'No se pudo guardar. Intentá de nuevo en unos segundos.'

/**
 * Traduce el contrato común de errores a errores por campo. Los detalles de
 * validación llegan como `"<campo> must ..."`; se reconoce el campo por prefijo.
 */
export function toFormErrors<Field extends string>(error: unknown, mapping: ErrorMapping<Field>): FormErrors<Field> {
  if (!(error instanceof ApiClientError)) return { fields: {}, form: GENERIC_ERROR }

  const codeField = mapping.codes?.[error.code]
  if (codeField) return { fields: { [codeField]: error.message } as FieldErrors<Field> }

  if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    const fields: FieldErrors<Field> = {}
    const knownFields = Object.keys(mapping.validation) as Field[]
    for (const detail of error.details as readonly string[]) {
      const field = knownFields.find((candidate) => detail.startsWith(`${candidate} `))
      if (field) fields[field] = mapping.validation[field]
    }
    if (Object.keys(fields).length > 0) return { fields }
  }

  return { fields: {}, form: error.status >= 500 ? GENERIC_ERROR : error.message }
}
