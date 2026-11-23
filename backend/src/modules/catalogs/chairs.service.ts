import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { DatabaseConnectionService } from '../../database/database-connection.service.js';
import { escapeLikePattern } from './catalog-normalization.js';
import { chairNameConflict, chairNotFound, isDuplicateEntryError } from './catalog-errors.js';
import { ChairEntity } from './chair.entity.js';
import type { ChairInputDto, ChairResponse } from './dto/catalog.dto.js';
import type { CatalogListQueryDto, Paginated } from './paginated.js';

export function toChairResponse(entity: ChairEntity): ChairResponse {
  return {
    id: entity.id,
    nombre: entity.name,
    activo: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

@Injectable()
export class ChairsService {
  constructor(private readonly database: DatabaseConnectionService) {}

  async list(query: CatalogListQueryDto): Promise<Paginated<ChairResponse>> {
    const builder = (await this.repository()).createQueryBuilder('chair');
    if (query.incluirInactivos !== true) {
      builder.andWhere('chair.active = :active', { active: true });
    }
    if (query.q) {
      builder.andWhere("chair.name LIKE :pattern ESCAPE '\\\\'", {
        pattern: `%${escapeLikePattern(query.q)}%`,
      });
    }
    const [entities, total] = await builder
      .orderBy('chair.name', 'ASC')
      .addOrderBy('chair.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { items: entities.map(toChairResponse), page: query.page, pageSize: query.pageSize, total };
  }

  async findById(id: string): Promise<ChairResponse> {
    return toChairResponse(await this.getEntity(id));
  }

  async create(input: ChairInputDto): Promise<ChairResponse> {
    const repository = await this.repository();
    const id = randomUUID();
    await this.translateConflicts(() => repository.insert({ id, name: input.nombre, active: true }));
    return this.findById(id);
  }

  async replace(id: string, input: ChairInputDto): Promise<ChairResponse> {
    await this.getEntity(id);
    const repository = await this.repository();
    await this.translateConflicts(() => repository.update({ id }, { name: input.nombre }));
    return this.findById(id);
  }

  async setActive(id: string, active: boolean): Promise<ChairResponse> {
    await this.getEntity(id);
    await (await this.repository()).update({ id }, { active });
    return this.findById(id);
  }

  private async getEntity(id: string): Promise<ChairEntity> {
    const entity = await (await this.repository()).findOneBy({ id });
    if (!entity) throw chairNotFound();
    return entity;
  }

  private async translateConflicts(write: () => Promise<unknown>): Promise<void> {
    try {
      await write();
    } catch (error: unknown) {
      if (isDuplicateEntryError(error)) throw chairNameConflict();
      throw error;
    }
  }

  private async repository(): Promise<Repository<ChairEntity>> {
    return (await this.database.ensureInitialized()).getRepository(ChairEntity);
  }
}
