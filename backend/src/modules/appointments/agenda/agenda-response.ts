import { isBlockingStatus, type AppointmentStatus } from '../core/domain/appointment-status.js';
import type { ExcepcionResponse, TramoResponse } from '../../availability/dto/availability.dto.js';
import { isoWeekday } from './domain/agenda-range.js';

/** Referencia mínima a otra entidad: solo `id` y `nombre`, nunca datos de contacto ni clínicos. */
export interface AgendaReference {
  id: string;
  nombre: string;
}

export interface AgendaTurnoResponse {
  id: string;
  estado: AppointmentStatus;
  /** Instantes ISO 8601 UTC con sufijo `Z`. */
  inicio: string;
  finAtencion: string;
  finBloqueo: string;
  duracionMinutos: number;
  intervaloPosteriorMinutos: number;
  /** Lo decide el backend según RN-TU-07; la interfaz no lo deduce. */
  bloqueaHorario: boolean;
  fueraDisponibilidad: boolean;
  motivoExcepcion: string | null;
  paciente: AgendaReference;
  prestacion: AgendaReference;
  sillon: AgendaReference;
}

export interface AgendaTramo {
  horaInicio: string;
  horaFin: string;
}

export interface AgendaBloqueo {
  id: string;
  tipo: string;
  motivo: string;
  /** Ambas horas nulas indican un bloqueo de día completo. */
  horaInicio: string | null;
  horaFin: string | null;
}

export interface AgendaDia {
  fecha: string;
  tramos: AgendaTramo[];
  bloqueos: AgendaBloqueo[];
}

export interface AgendaResponse {
  zonaHoraria: string;
  desde: string;
  hasta: string;
  /** Reloj del servidor al iniciar la consulta, en UTC. */
  generadoEn: string;
  turnos: AgendaTurnoResponse[];
  dias: AgendaDia[];
}

export interface UpcomingAgendaResponse {
  zonaHoraria: string;
  desde: string;
  generadoEn: string;
  turnos: AgendaTurnoResponse[];
}

/** Fila de la consulta de agenda: solo las columnas que la respuesta necesita. */
export interface AgendaRow {
  id: string;
  status: AppointmentStatus;
  startsAt: Date;
  careEndsAt: Date;
  blockEndsAt: Date;
  durationMinutes: number;
  postIntervalMinutes: number;
  outsideAvailability: number | boolean;
  exceptionReason: string | null;
  patientId: string;
  patientName: string;
  procedureId: string;
  procedureName: string;
  chairId: string;
  chairName: string;
}

export function toAgendaTurno(row: AgendaRow): AgendaTurnoResponse {
  const outside = row.outsideAvailability === true || row.outsideAvailability === 1;
  return {
    id: row.id,
    estado: row.status,
    inicio: row.startsAt.toISOString(),
    finAtencion: row.careEndsAt.toISOString(),
    finBloqueo: row.blockEndsAt.toISOString(),
    duracionMinutos: Number(row.durationMinutes),
    intervaloPosteriorMinutos: Number(row.postIntervalMinutes),
    bloqueaHorario: isBlockingStatus(row.status),
    fueraDisponibilidad: outside,
    motivoExcepcion: outside ? row.exceptionReason : null,
    paciente: { id: row.patientId, nombre: row.patientName },
    prestacion: { id: row.procedureId, nombre: row.procedureName },
    sillon: { id: row.chairId, nombre: row.chairName },
  };
}

const toHourMinute = (value: string): string => value.slice(0, 5);

/** Arma `dias`: una entrada por fecha, con los tramos semanales y los bloqueos activos de ese día. */
export function buildAgendaDays(
  dias: readonly string[],
  tramos: readonly TramoResponse[],
  excepciones: readonly ExcepcionResponse[],
): AgendaDia[] {
  return dias.map((fecha) => {
    const weekday = isoWeekday(fecha);
    return {
      fecha,
      tramos: tramos
        .filter((tramo) => tramo.diaSemana === weekday)
        .map((tramo) => ({ horaInicio: toHourMinute(tramo.horaInicio), horaFin: toHourMinute(tramo.horaFin) }))
        .sort((left, right) => left.horaInicio.localeCompare(right.horaInicio)),
      bloqueos: excepciones
        .filter((excepcion) => excepcion.activo && excepcion.fecha === fecha)
        .map((excepcion) => ({
          id: excepcion.id,
          tipo: excepcion.tipo,
          motivo: excepcion.motivo,
          horaInicio: excepcion.horaInicio === null ? null : toHourMinute(excepcion.horaInicio),
          horaFin: excepcion.horaFin === null ? null : toHourMinute(excepcion.horaFin),
        }))
        .sort((left, right) => {
          const leftStart = left.horaInicio ?? '';
          const rightStart = right.horaInicio ?? '';
          return leftStart.localeCompare(rightStart) || left.id.localeCompare(right.id);
        }),
    };
  });
}
