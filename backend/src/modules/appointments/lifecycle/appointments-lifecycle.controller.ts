import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CancelAppointmentService } from './cancel-appointment.service.js';
import { ChangeAppointmentStatusService } from './change-appointment-status.service.js';
import type { AppointmentLifecycleResponse } from './dto/appointment-lifecycle-response.js';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import { ChangeAppointmentStatusDto } from './dto/change-appointment-status.dto.js';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto.js';
import { RescheduleAppointmentService } from './reschedule-appointment.service.js';

/** Protegido por el `SessionGuard` global de C-04 (no es `@Public()`). */
@Controller('turnos')
export class AppointmentsLifecycleController {
  constructor(
    private readonly rescheduleService: RescheduleAppointmentService,
    private readonly cancelService: CancelAppointmentService,
    private readonly statusService: ChangeAppointmentStatusService,
  ) {}

  @Patch(':id/reprogramar')
  reschedule(
    @Param('id') id: string,
    @Body() input: RescheduleAppointmentDto,
  ): Promise<AppointmentLifecycleResponse> {
    return this.rescheduleService.reschedule(id, input);
  }

  @Patch(':id/cancelar')
  cancel(@Param('id') id: string, @Body() input: CancelAppointmentDto): Promise<AppointmentLifecycleResponse> {
    return this.cancelService.cancel(id, input);
  }

  @Patch(':id/estado')
  changeStatus(
    @Param('id') id: string,
    @Body() input: ChangeAppointmentStatusDto,
  ): Promise<AppointmentLifecycleResponse> {
    return this.statusService.changeStatus(id, input);
  }
}
