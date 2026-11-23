import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import {
  ChairInputDto,
  ProcedureInputDto,
  SetActiveDto,
  type ChairResponse,
  type ProcedureResponse,
} from './dto/catalog.dto.js';
import { CatalogListQueryDto, type Paginated } from './paginated.js';
import { ChairsService } from './chairs.service.js';
import { ProceduresService } from './procedures.service.js';

@Controller('prestaciones')
export class ProceduresController {
  constructor(private readonly procedures: ProceduresService) {}

  @Get()
  list(@Query() query: CatalogListQueryDto): Promise<Paginated<ProcedureResponse>> {
    return this.procedures.list(query);
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<ProcedureResponse> {
    return this.procedures.findById(id);
  }

  @Post()
  create(@Body() input: ProcedureInputDto): Promise<ProcedureResponse> {
    return this.procedures.create(input);
  }

  @Put(':id')
  replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ProcedureInputDto,
  ): Promise<ProcedureResponse> {
    return this.procedures.replace(id, input);
  }

  @Patch(':id/estado')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetActiveDto,
  ): Promise<ProcedureResponse> {
    return this.procedures.setActive(id, input.activo);
  }
}

@Controller('sillones')
export class ChairsController {
  constructor(private readonly chairs: ChairsService) {}

  @Get()
  list(@Query() query: CatalogListQueryDto): Promise<Paginated<ChairResponse>> {
    return this.chairs.list(query);
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<ChairResponse> {
    return this.chairs.findById(id);
  }

  @Post()
  create(@Body() input: ChairInputDto): Promise<ChairResponse> {
    return this.chairs.create(input);
  }

  @Put(':id')
  replace(@Param('id', ParseUUIDPipe) id: string, @Body() input: ChairInputDto): Promise<ChairResponse> {
    return this.chairs.replace(id, input);
  }

  @Patch(':id/estado')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetActiveDto,
  ): Promise<ChairResponse> {
    return this.chairs.setActive(id, input.activo);
  }
}
