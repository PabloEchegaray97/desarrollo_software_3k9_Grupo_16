import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { DatabaseConnectionService } from '../../database/database-connection.service.js';
import { PatientEntity } from './patient.entity.js';

export interface PatientReference {
  id: string;
  nombre: string;
  activo: boolean;
}

/**
 * Puerto de lectura para otros módulos (C-05 en adelante). Devuelve también
 * pacientes inactivos: decidir si se aceptan corresponde al consumidor.
 * El `EntityManager` opcional permite leer dentro de una transacción ajena.
 */
@Injectable()
export class PatientReferences {
  constructor(private readonly database: DatabaseConnectionService) {}

  async findById(id: string, manager?: EntityManager): Promise<PatientReference | null> {
    const source = manager ?? (await this.database.ensureInitialized()).manager;
    const entity = await source.findOneBy(PatientEntity, { id });
    return entity ? { id: entity.id, nombre: entity.name, activo: entity.active } : null;
  }
}
