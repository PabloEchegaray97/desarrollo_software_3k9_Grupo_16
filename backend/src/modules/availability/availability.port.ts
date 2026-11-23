import type { ResultadoEvaluacion } from './domain/availability-policy.js';

/** Token estable consumido por C-05; la implementación la provee `AvailabilityModule`. */
export const AVAILABILITY_EVALUATION_PORT = Symbol('AVAILABILITY_EVALUATION_PORT');

export interface SolicitudEvaluacionPort {
  fecha: string;
  horaInicio: string;
  duracionMinutos: number;
  intervaloPosteriorMinutos?: number;
}

export interface AvailabilityEvaluationPort {
  evaluar(solicitud: SolicitudEvaluacionPort): Promise<ResultadoEvaluacion>;
}
