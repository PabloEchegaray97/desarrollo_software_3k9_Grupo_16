import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module.js';
import { APPOINTMENT_CLOCK, SystemClock } from './clock.js';
import { APPOINTMENT_TRANSACTION_BOUNDARY, TypeOrmTransactionBoundary } from './database/typeorm-transaction-boundary.js';

/**
 * Núcleo compartido de turnos. Contrato para C-06/C-07: entidades, estados, política,
 * `findBlockingConflicts`, frontera transaccional con lock de agenda y reloj.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    TypeOrmTransactionBoundary,
    { provide: APPOINTMENT_TRANSACTION_BOUNDARY, useExisting: TypeOrmTransactionBoundary },
    { provide: APPOINTMENT_CLOCK, useClass: SystemClock },
  ],
  exports: [APPOINTMENT_TRANSACTION_BOUNDARY, APPOINTMENT_CLOCK],
})
export class AppointmentCoreModule {}
