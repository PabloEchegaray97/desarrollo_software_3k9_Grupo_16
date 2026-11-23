export interface Procedure {
  id: string
  nombre: string
  duracionPredeterminadaMinutos: number
  /** `null`: se aplica el intervalo global configurado en disponibilidad. */
  intervaloPosteriorMinutos: number | null
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface ProcedureInput {
  nombre: string
  duracionPredeterminadaMinutos: number
  intervaloPosteriorMinutos: number | null
}

export interface Chair {
  id: string
  nombre: string
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface ChairInput {
  nombre: string
}

export interface CatalogListParams {
  q?: string
  incluirInactivos?: boolean
  page?: number
  pageSize?: number
}

export type CatalogSection = 'prestaciones' | 'sillones'
