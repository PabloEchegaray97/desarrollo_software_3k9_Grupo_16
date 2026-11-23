import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { DatabaseConnectionService } from '../../database/database-connection.service.js';
import { escapeLikePattern } from './catalog-normalization.js';
import { isDuplicateEntryError, procedureNameConflict, procedureNotFound } from './catalog-errors.js';
import type { ProcedureInputDto, ProcedureResponse } from './dto/catalog.dto.js';
import type { CatalogListQueryDto, Paginated } from './paginated.js';
import { ProcedureEntity } from './procedure.entity.js';

export function toProcedureResponse(entity: ProcedureEntity): ProcedureResponse {
  return {
    id: entity.id,
    nombre: entity.name,
    duracionPredeterminadaMinutos: entity.defaultDurationMinutes,
    intervaloPosteriorMinutos: entity.postIntervalMinutes,
    activo: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

@Injectable()
export class ProceduresService {
  constructor(private readonly database: DatabaseConnectionService) {}

  async list(query: CatalogListQueryDto): Promise<Paginated<ProcedureResponse>> {
    const builder = (await this.repository()).createQueryBuilder('procedure');
    if (query.incluirInactivos !== true) {
      builder.andWhere('procedure.active = :active', { active: true });
    }
    if (query.q) {
      builder.andWhere("procedure.name LIKE :pattern ESCAPE '\\\\'", {
        pattern: `%${escapeLikePattern(query.q)}%`,
      });
    }
    const [entities, total] = await builder
      .orderBy('procedure.name', 'ASC')
      .addOrderBy('procedure.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { items: entities.map(toProcedureResponse), page: query.page, pageSize: query.pageSize, total };
  }

  async findById(id: string): Promise<ProcedureResponse> {
    return toProcedureResponse(await this.getEntity(id));
  }

  async create(input: ProcedureInputDto): Promise<ProcedureResponse> {
    const repository = await this.repository();
    const id = randomUUID();
    await this.translateConflicts(() =>
      repository.insert({ id, ...this.toColumns(input), active: true }),
    );
    return this.findById(id);
  }

  async replace(id: string, input: ProcedureInputDto): Promise<ProcedureResponse> {
    await this.getEntity(id);
    const repository = await this.repository();
    await this.translateConflicts(() => repository.update({ id }, this.toColumns(input)));
    return this.findById(id);
  }

  async setActive(id: string, active: boolean): Promise<ProcedureResponse> {
    await this.getEntity(id);
    await (await this.repository()).update({ id }, { active });
    return this.findById(id);
  }

  private toColumns(
    input: ProcedureInputDto,
  ): Pick<ProcedureEntity, 'name' | 'defaultDurationMinutes' | 'postIntervalMinutes'> {
    return {
      name: input.nombre,
      defaultDurationMinutes: input.duracionPredeterminadaMinutos,
      postIntervalMinutes: input.intervaloPosteriorMinutos ?? null,
    };
  }

  private async getEntity(id: string): Promise<ProcedureEntity> {
    const entity = await (await this.repository()).findOneBy({ id });
    if (!entity) throw procedureNotFound();
    return entity;
  }

  private async translateConflicts(write: () => Promise<unknown>): Promise<void> {
    try {
      await write();
    } catch (error: unknown) {
      if (isDuplicateEntryError(error)) throw procedureNameConflict();
      throw error;
    }
  }

  private async repository(): Promise<Repository<ProcedureEntity>> {
    return (await this.database.ensureInitialized()).getRepository(ProcedureEntity);
  }
}
