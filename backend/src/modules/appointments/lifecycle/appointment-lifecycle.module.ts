import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../../availability/availability.module.js';
import { CatalogsModule } from '../../catalogs/catalogs.module.js';
import { AppointmentCoreModule } from '../core/appointment-core.module.js';
import { AppointmentsLifecycleController } from './appointments-lifecycle.controller.js';
import { CancelAppointmentService } from './cancel-appointment.service.js';
import { ChangeAppointmentStatusService } from './change-appointment-status.service.js';
import { GetAppointmentService } from './get-appointment.service.js';
import { RescheduleAppointmentService } from './reschedule-appointment.service.js';

/** Compone el ciclo de vida sin editar `appointments.module.ts` (design § Módulos backend). */
@Module({
  imports: [AppointmentCoreModule, AvailabilityModule, CatalogsModule],
  controllers: [AppointmentsLifecycleController],
  providers: [
    GetAppointmentService,
    RescheduleAppointmentService,
    CancelAppointmentService,
    ChangeAppointmentStatusService,
  ],
})
export class AppointmentLifecycleModule {}
