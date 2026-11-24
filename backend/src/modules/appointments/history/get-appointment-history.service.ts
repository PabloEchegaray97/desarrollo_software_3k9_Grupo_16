import { Inject, Injectable } from '@nestjs/common';
import { AppointmentWriter } from '../core/database/appointment-writer.js';
import { APPOINTMENT_TRANSACTION_BOUNDARY } from '../core/database/typeorm-transaction-boundary.js';
import { readLifecycleHistory } from '../lifecycle/lifecycle-history.reader.js';
import { loadAppointment, type AppointmentTransactions } from '../lifecycle/lifecycle-transaction.js';
import type { AppointmentHistoryResponse } from './dto/appointment-history-response.js';

/** Consulta cronológica sin paginación; la proyección y el orden viven en `lifecycle-history.reader.ts`. */
@Injectable()
export class GetAppointmentHistoryService {
  constructor(
    @Inject(APPOINTMENT_TRANSACTION_BOUNDARY) private readonly transactions: AppointmentTransactions,
    private readonly writer: AppointmentWriter,
  ) {}

  async getHistory(appointmentId: string): Promise<AppointmentHistoryResponse> {
    const eventos = await this.transactions.run(async (context) => {
      // La misma traducción a 404 que usan las mutaciones: sin filtrar por datos del turno.
      await loadAppointment(context, this.writer, appointmentId);
      return readLifecycleHistory(context.manager, appointmentId);
    });
    return { turnoId: appointmentId, eventos };
  }
}
