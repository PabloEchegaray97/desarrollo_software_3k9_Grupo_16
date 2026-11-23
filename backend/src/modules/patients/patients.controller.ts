import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import {
  PatientInputDto,
  PatientListQueryDto,
  SetPatientActiveDto,
  type Paginated,
  type PatientResponse,
} from './dto/patient.dto.js';
import { PatientsService } from './patients.service.js';

@Controller('pacientes')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  list(@Query() query: PatientListQueryDto): Promise<Paginated<PatientResponse>> {
    return this.patients.list(query);
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<PatientResponse> {
    return this.patients.findById(id);
  }

  @Post()
  create(@Body() input: PatientInputDto): Promise<PatientResponse> {
    return this.patients.create(input);
  }

  @Put(':id')
  replace(@Param('id', ParseUUIDPipe) id: string, @Body() input: PatientInputDto): Promise<PatientResponse> {
    return this.patients.replace(id, input);
  }

  @Patch(':id/estado')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetPatientActiveDto,
  ): Promise<PatientResponse> {
    return this.patients.setActive(id, input.activo);
  }
}
