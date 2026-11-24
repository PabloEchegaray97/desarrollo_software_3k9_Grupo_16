import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AvailabilityService } from '../../availability/availability.service.js';
import { ZONA_IANA } from '../../availability/availability.constants.js';
import { horaLocalAUtc } from '../../availability/domain/availability-policy.js';
import { APPOINTMENT_CLOCK, type Clock } from '../core/clock.js';
import { chairNotFound, rangeInvalid, rangeTooLarge } from './agenda-errors.js';
import {
  buildAgendaDays,
  toAgendaTurno,
  type AgendaResponse,
  type AgendaRow,
} from './agenda-response.js';
import { addDaysToLocalDate, resolveAgendaRange } from './domain/agenda-range.js';
import type { AgendaQueryDto } from './dto/agenda-query.dto.js';

/** Columnas explícitas: teléfono, DNI, email y motivo de cancelación nunca se leen. */
const AGENDA_SELECT = `
  SELECT a.id AS id,
         a.status AS status,
         a.starts_at AS startsAt,
         a.care_ends_at AS careEndsAt,
         a.block_ends_at AS blockEndsAt,
         a.duration_minutes AS durationMinutes,
         a.post_interval_minutes AS postIntervalMinutes,
         a.outside_availability AS outsideAvailability,
         a.exception_reason AS exceptionReason,
         p.id AS patientId,
         p.name AS patientName,
         pr.id AS procedureId,
         pr.name AS procedureName,
         c.id AS chairId,
         c.name AS chairName
  FROM appointments a
  INNER JOIN patients p ON p.id = a.patient_id
  INNER JOIN procedures pr ON pr.id = a.procedure_id
  INNER JOIN chairs c ON c.id = a.chair_id`;

/** Lectura de agenda (US-032). No calcula disponibilidad ni conflictos: presenta lo que ya decidió el backend. */
@Injectable()
export class AgendaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly availability: AvailabilityService,
    @Inject(APPOINTMENT_CLOCK) private readonly clock: Clock,
  ) {}

  async consultar(query: AgendaQueryDto): Promise<AgendaResponse> {
    const generadoEn = this.clock.now().toISOString();

    const resolved = resolveAgendaRange(query.desde, query.hasta);
    if (!resolved.ok) {
      throw resolved.problem === 'TOO_LARGE' ? rangeTooLarge(resolved.requestedDays) : rangeInvalid();
    }
    const { range } = resolved;

    const from = horaLocalAUtc(range.desde, '00:00', ZONA_IANA);
    const to = horaLocalAUtc(addDaysToLocalDate(range.hasta, 1), '00:00', ZONA_IANA);
    if (from === null || to === null) {
      throw rangeInvalid();
    }

    if (query.sillonId !== undefined) {
      await this.requireChair(query.sillonId);
    }

    const [rows, semanales, excepciones] = await Promise.all([
      this.readAppointments(new Date(from), new Date(to), query),
      this.availability.getSemanales(),
      this.availability.listExcepciones(),
    ]);

    return {
      zonaHoraria: ZONA_IANA,
      desde: range.desde,
      hasta: range.hasta,
      generadoEn,
      turnos: rows.map(toAgendaTurno),
      dias: buildAgendaDays(range.dias, semanales.tramos, excepciones),
    };
  }

  private async requireChair(chairId: string): Promise<void> {
    const rows = (await this.dataSource.query('SELECT id FROM chairs WHERE id = ? LIMIT 1', [chairId])) as unknown[];
    if (rows.length === 0) {
      throw chairNotFound();
    }
  }

  private async readAppointments(from: Date, to: Date, query: AgendaQueryDto): Promise<AgendaRow[]> {
    const conditions = ['a.starts_at >= ?', 'a.starts_at < ?'];
    const parameters: Array<Date | string> = [from, to];

    if (query.sillonId !== undefined) {
      conditions.push('a.chair_id = ?');
      parameters.push(query.sillonId);
    }
    if (query.estado !== undefined) {
      const statuses = [...new Set(query.estado)];
      conditions.push(`a.status IN (${statuses.map(() => '?').join(', ')})`);
      parameters.push(...statuses);
    }

    const sql = `${AGENDA_SELECT}
  WHERE ${conditions.join(' AND ')}
  ORDER BY a.starts_at ASC, a.created_at ASC, a.id ASC`;
    return (await this.dataSource.query(sql, parameters)) as AgendaRow[];
  }
}
