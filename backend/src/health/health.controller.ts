import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService, type HealthBody } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthBody> {
    const result = await this.healthService.check();
    response.status(result.statusCode);
    return result.body;
  }
}
