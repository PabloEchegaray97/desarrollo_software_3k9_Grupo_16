import { Module } from '@nestjs/common';
import { AppointmentCoreModule } from '../core/appointment-core.module.js';
import { AppointmentsHistoryController } from './appointments-history.controller.js';
import { GetAppointmentHistoryService } from './get-appointment-history.service.js';

/** Compone la consulta del historial sin editar `appointments.module.ts`. */
@Module({
  imports: [AppointmentCoreModule],
  controllers: [AppointmentsHistoryController],
  providers: [GetAppointmentHistoryService],
})
export class AppointmentHistoryModule {}
