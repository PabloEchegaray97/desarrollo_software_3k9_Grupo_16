import { Controller, Get, Query } from '@nestjs/common';
import type { AgendaResponse, UpcomingAgendaResponse } from './agenda-response.js';
import { AgendaService } from './agenda.service.js';
import { AgendaQueryDto, UpcomingAgendaQueryDto } from './dto/agenda-query.dto.js';

/** Protegido por el `SessionGuard` global de C-04 (no es `@Public()`). */
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get('proximos')
  consultarProximos(@Query() query: UpcomingAgendaQueryDto): Promise<UpcomingAgendaResponse> {
    return this.agenda.consultarProximos(query);
  }

  @Get()
  consultar(@Query() query: AgendaQueryDto): Promise<AgendaResponse> {
    return this.agenda.consultar(query);
  }
}
