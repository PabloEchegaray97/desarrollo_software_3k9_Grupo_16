import { Controller, Get, Param } from '@nestjs/common';
import type { AppointmentHistoryResponse } from './dto/appointment-history-response.js';
import { GetAppointmentHistoryService } from './get-appointment-history.service.js';

/** Protegido por el `SessionGuard` global de C-04; no expone edición ni borrado de eventos. */
@Controller('turnos')
export class AppointmentsHistoryController {
  constructor(private readonly service: GetAppointmentHistoryService) {}

  @Get(':id/historial')
  getHistory(@Param('id') id: string): Promise<AppointmentHistoryResponse> {
    return this.service.getHistory(id);
  }
}
