import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { AvailabilityService } from './availability.service.js';
import {
  ConfiguracionPatchDto,
  EvaluacionPostDto,
  ExcepcionEstadoPatchDto,
  ExcepcionPostDto,
  SemanalesPutDto,
  type ConfiguracionResponse,
  type ExcepcionResponse,
  type ResultadoEvaluacion,
  type SemanalesResponse,
} from './dto/availability.dto.js';

/** Contrato HTTP de disponibilidad. Las reglas viven en `AvailabilityService`. */
@Controller('disponibilidad')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get('configuracion')
  getConfiguracion(): Promise<ConfiguracionResponse> {
    return this.availability.getConfiguracion();
  }

  @Patch('configuracion')
  patchConfiguracion(@Body() input: ConfiguracionPatchDto): Promise<ConfiguracionResponse> {
    return this.availability.patchConfiguracion(input);
  }

  @Get('semanales')
  getSemanales(): Promise<SemanalesResponse> {
    return this.availability.getSemanales();
  }

  @Put('semanales')
  putSemanales(@Body() input: SemanalesPutDto): Promise<SemanalesResponse> {
    return this.availability.putSemanales(input);
  }

  @Get('excepciones')
  listExcepciones(): Promise<ExcepcionResponse[]> {
    return this.availability.listExcepciones();
  }

  @Get('excepciones/:id')
  getExcepcion(@Param('id', ParseUUIDPipe) id: string): Promise<ExcepcionResponse> {
    return this.availability.getExcepcion(id);
  }

  @Post('excepciones')
  @HttpCode(HttpStatus.CREATED)
  createExcepcion(@Body() input: ExcepcionPostDto): Promise<ExcepcionResponse> {
    return this.availability.createExcepcion(input);
  }

  @Patch('excepciones/:id')
  setExcepcionActivo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ExcepcionEstadoPatchDto,
  ): Promise<ExcepcionResponse> {
    return this.availability.setExcepcionActivo(id, input.activo);
  }

  @Post('evaluacion')
  @HttpCode(HttpStatus.OK)
  evaluar(@Body() input: EvaluacionPostDto): Promise<ResultadoEvaluacion> {
    return this.availability.evaluar(input);
  }
}
