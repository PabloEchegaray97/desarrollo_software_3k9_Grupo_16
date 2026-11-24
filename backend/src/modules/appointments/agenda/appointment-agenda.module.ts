import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module.js';
import { AvailabilityModule } from '../../availability/availability.module.js';
import { AppointmentCoreModule } from '../core/appointment-core.module.js';
import { AgendaController } from './agenda.controller.js';
import { AgendaService } from './agenda.service.js';

/** Lectura de agenda: consume el núcleo de C-05 y la disponibilidad de C-03 sin tocar `app.module.ts`. */
@Module({
  imports: [DatabaseModule, AppointmentCoreModule, AvailabilityModule],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AppointmentAgendaModule {}
