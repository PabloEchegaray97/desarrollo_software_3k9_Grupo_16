import { Module } from '@nestjs/common';
import { AppointmentAgendaModule } from './agenda/appointment-agenda.module.js';
import { AppointmentCreationModule } from './creation/appointment-creation.module.js';
import { AppointmentHistoryModule } from './history/appointment-history.module.js';
import { AppointmentLifecycleModule } from './lifecycle/appointment-lifecycle.module.js';

@Module({
  imports: [
    AppointmentCreationModule,
    AppointmentLifecycleModule,
    AppointmentHistoryModule,
    AppointmentAgendaModule,
  ],
})
export class AppointmentsModule {}
