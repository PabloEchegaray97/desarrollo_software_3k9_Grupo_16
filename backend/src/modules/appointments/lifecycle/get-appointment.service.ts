import { Inject, Injectable } from '@nestjs/common';
import { AppointmentWriter } from '../core/database/appointment-writer.js';
import { APPOINTMENT_TRANSACTION_BOUNDARY } from '../core/database/typeorm-transaction-boundary.js';
import type { AppointmentLifecycleResponse } from './dto/appointment-lifecycle-response.js';
import { toLifecycleAppointmentResponse } from './lifecycle-appointment.mapper.js';
import { readLifecycleHistory } from './lifecycle-history.reader.js';
import { loadAppointment, type AppointmentTransactions } from './lifecycle-transaction.js';

/** Consulta el turno y su historial con el mismo contrato que devuelven las mutaciones. */
@Injectable()
export class GetAppointmentService {
  constructor(
    @Inject(APPOINTMENT_TRANSACTION_BOUNDARY) private readonly transactions: AppointmentTransactions,
    private readonly writer: AppointmentWriter,
  ) {}

  getById(id: string): Promise<AppointmentLifecycleResponse> {
    return this.transactions.run(async (context) => {
      const appointment = await loadAppointment(context, this.writer, id);
      const history = await readLifecycleHistory(context.manager, id);

      return {
        turno: toLifecycleAppointmentResponse(appointment),
        historial: history,
      };
    });
  }
}
