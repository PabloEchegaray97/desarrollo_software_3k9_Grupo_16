import type { ReactNode } from 'react'
import type { AgendaTurno } from './types'

/**
 * Punto de integración para las acciones de C-06 (confirmar, atender, ausencia, cancelar, reprogramar).
 * C-07 no importa ni edita componentes de lifecycle: C-08 conecta `renderActions` en el ensamble final.
 */
export interface AgendaActionsContext {
  /** Datos del turno ya mostrados en el detalle. */
  turno: AgendaTurno
  /** La acción externa avisa que algo cambió; la agenda vuelve a consultar con fecha y filtros vigentes. */
  onChanged: () => void
}

export type AgendaActionsRenderer = (context: AgendaActionsContext) => ReactNode

export interface AppointmentAgendaPageProps {
  renderActions?: AgendaActionsRenderer
}
