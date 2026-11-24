import { Body, Controller, Post } from '@nestjs/common';
import { CreateAppointmentService } from './create-appointment.service.js';
import { CreateAppointmentDto, type AppointmentResponse } from './dto/create-appointment.dto.js';

/** Protegido por el `SessionGuard` global de C-04 (no es `@Public()`). */
@Controller('turnos')
export class AppointmentsController {
  constructor(private readonly creation: CreateAppointmentService) {}

  @Post()
  create(@Body() input: CreateAppointmentDto): Promise<AppointmentResponse> {
    return this.creation.create(input);
  }
}
