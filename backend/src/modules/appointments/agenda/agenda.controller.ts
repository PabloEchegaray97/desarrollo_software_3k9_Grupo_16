import { Controller, Get, Query } from '@nestjs/common';
import type { AgendaResponse } from './agenda-response.js';
import { AgendaService } from './agenda.service.js';
import { AgendaQueryDto } from './dto/agenda-query.dto.js';

/** Protegido por el `SessionGuard` global de C-04 (no es `@Public()`). */
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  consultar(@Query() query: AgendaQueryDto): Promise<AgendaResponse> {
    return this.agenda.consultar(query);
  }
}
