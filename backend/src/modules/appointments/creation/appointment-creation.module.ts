import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../../availability/availability.module.js';
import { CatalogsModule } from '../../catalogs/catalogs.module.js';
import { PatientsModule } from '../../patients/patients.module.js';
import { AppointmentCoreModule } from '../core/appointment-core.module.js';
import { AppointmentsController } from './appointments.controller.js';
import { CreateAppointmentService } from './create-appointment.service.js';

/** Alta de turnos: compone los contratos de C-02, C-03 y el núcleo, sin tocar `app.module.ts`. */
@Module({
  imports: [AppointmentCoreModule, PatientsModule, CatalogsModule, AvailabilityModule],
  controllers: [AppointmentsController],
  providers: [CreateAppointmentService],
})
export class AppointmentCreationModule {}
