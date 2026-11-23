import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { PatientReferences } from './patient-references.js';
import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientReferences],
  exports: [PatientReferences],
})
export class PatientsModule {}
