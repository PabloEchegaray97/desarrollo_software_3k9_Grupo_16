import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { DatabaseConnectionService } from '../../database/database-connection.service.js';
import { ChairEntity } from './chair.entity.js';
import { ProcedureEntity } from './procedure.entity.js';

export interface ProcedureReference {
  id: string;
  nombre: string;
  activo: boolean;
  duracionPredeterminadaMinutos: number;
  /** `null`: la prestación delega en el intervalo global. */
  intervaloPosteriorMinutos: number | null;
}

export interface ChairReference {
  id: string;
  nombre: string;
  activo: boolean;
}

/**
 * Puerto de lectura para otros módulos (C-05 en adelante). Devuelve también
 * registros inactivos: decidir si se aceptan corresponde al consumidor.
 * El `EntityManager` opcional permite leer dentro de una transacción ajena.
 */
@Injectable()
export class CatalogReferences {
  constructor(private readonly database: DatabaseConnectionService) {}

  async findProcedureById(id: string, manager?: EntityManager): Promise<ProcedureReference | null> {
    const entity = await (await this.manager(manager)).findOneBy(ProcedureEntity, { id });
    if (!entity) return null;
    return {
      id: entity.id,
      nombre: entity.name,
      activo: entity.active,
      duracionPredeterminadaMinutos: entity.defaultDurationMinutes,
      intervaloPosteriorMinutos: entity.postIntervalMinutes,
    };
  }

  async findChairById(id: string, manager?: EntityManager): Promise<ChairReference | null> {
    const entity = await (await this.manager(manager)).findOneBy(ChairEntity, { id });
    if (!entity) return null;
    return { id: entity.id, nombre: entity.name, activo: entity.active };
  }

  private async manager(manager: EntityManager | undefined): Promise<EntityManager> {
    return manager ?? (await this.database.ensureInitialized()).manager;
  }
}
