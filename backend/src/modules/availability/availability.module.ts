import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';
import { AVAILABILITY_EVALUATION_PORT } from './availability.port.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AvailabilityController],
  providers: [
    AvailabilityService,
    { provide: AVAILABILITY_EVALUATION_PORT, useExisting: AvailabilityService },
  ],
  exports: [AvailabilityService, AVAILABILITY_EVALUATION_PORT],
})
export class AvailabilityModule {}
