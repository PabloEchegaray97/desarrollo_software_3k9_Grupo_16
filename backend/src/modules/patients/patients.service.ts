import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Brackets, Not, type Repository } from 'typeorm';
import { DatabaseConnectionService } from '../../database/database-connection.service.js';
import type {
  DuplicateCandidate,
  Paginated,
  PatientInputDto,
  PatientListQueryDto,
  PatientResponse,
} from './dto/patient.dto.js';
import { digitSearchTerm, escapeLikePattern, phoneDigits } from './patient-normalization.js';
import {
  isDuplicateEntryError,
  patientDniConflict,
  patientNotFound,
  patientPossibleDuplicate,
} from './patient-errors.js';
import { PatientEntity } from './patient.entity.js';

const MAX_DUPLICATE_CANDIDATES = 10;

type PatientColumns = Pick<PatientEntity, 'name' | 'phone' | 'phoneDigits' | 'dni' | 'email'>;

export function toPatientResponse(entity: PatientEntity): PatientResponse {
  return {
    id: entity.id,
    nombre: entity.name,
    telefono: entity.phone,
    dni: entity.dni,
    email: entity.email,
    activo: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

@Injectable()
export class PatientsService {
  constructor(private readonly database: DatabaseConnectionService) {}

  async list(query: PatientListQueryDto): Promise<Paginated<PatientResponse>> {
    const builder = (await this.repository()).createQueryBuilder('patient');
    if (query.incluirInactivos !== true) {
      builder.andWhere('patient.active = :active', { active: true });
    }
    if (query.q) {
      const digits = digitSearchTerm(query.q);
      builder.andWhere(
        new Brackets((match) => {
          match.where("patient.name LIKE :namePattern ESCAPE '\\\\'", {
            namePattern: `%${escapeLikePattern(query.q ?? '')}%`,
          });
          if (digits !== null) {
            match
              .orWhere('patient.phone_digits LIKE :digitsPattern', { digitsPattern: `%${digits}%` })
              .orWhere('patient.dni LIKE :digitsPattern', { digitsPattern: `%${digits}%` });
          }
        }),
      );
    }
    const [entities, total] = await builder
      .orderBy('patient.name', 'ASC')
      .addOrderBy('patient.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { items: entities.map(toPatientResponse), page: query.page, pageSize: query.pageSize, total };
  }

  async findById(id: string): Promise<PatientResponse> {
    return toPatientResponse(await this.getEntity(id));
  }

  async create(input: PatientInputDto): Promise<PatientResponse> {
    const columns = this.toColumns(input);
    if (input.confirmarPosibleDuplicado !== true) {
      await this.rejectPossibleDuplicates(columns);
    }
    const id = randomUUID();
    const repository = await this.repository();
    await this.translateConflicts(() => repository.insert({ id, ...columns, active: true }));
    return this.findById(id);
  }

  async replace(id: string, input: PatientInputDto): Promise<PatientResponse> {
    const existing = await this.getEntity(id);
    const columns = this.toColumns(input);
    if (input.confirmarPosibleDuplicado !== true && this.identityChanged(existing, columns)) {
      await this.rejectPossibleDuplicates(columns, id);
    }
    const repository = await this.repository();
    await this.translateConflicts(() => repository.update({ id }, columns));
    return this.findById(id);
  }

  async setActive(id: string, active: boolean): Promise<PatientResponse> {
    await this.getEntity(id);
    await (await this.repository()).update({ id }, { active });
    return this.findById(id);
  }

  /** Coincidencia de nombre (collation case-insensitive) y dígitos del teléfono. */
  async findPossibleDuplicates(
    columns: Pick<PatientColumns, 'name' | 'phoneDigits'>,
    excludeId?: string,
  ): Promise<DuplicateCandidate[]> {
    const matches = await (await this.repository()).find({
      select: { id: true, name: true, active: true },
      where: {
        name: columns.name,
        phoneDigits: columns.phoneDigits,
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
      order: { name: 'ASC', id: 'ASC' },
      take: MAX_DUPLICATE_CANDIDATES,
    });
    return matches.map((match) => ({ id: match.id, nombre: match.name, activo: match.active }));
  }

  private async rejectPossibleDuplicates(columns: PatientColumns, excludeId?: string): Promise<void> {
    const candidates = await this.findPossibleDuplicates(columns, excludeId);
    if (candidates.length > 0) throw patientPossibleDuplicate(candidates);
  }

  /** La advertencia solo se reevalúa si cambia el nombre o los dígitos del teléfono. */
  private identityChanged(existing: PatientEntity, columns: PatientColumns): boolean {
    return (
      existing.name.toLocaleLowerCase('es') !== columns.name.toLocaleLowerCase('es') ||
      existing.phoneDigits !== columns.phoneDigits
    );
  }

  private toColumns(input: PatientInputDto): PatientColumns {
    return {
      name: input.nombre,
      phone: input.telefono,
      phoneDigits: phoneDigits(input.telefono),
      dni: input.dni ?? null,
      email: input.email ?? null,
    };
  }

  private async getEntity(id: string): Promise<PatientEntity> {
    const entity = await (await this.repository()).findOneBy({ id });
    if (!entity) throw patientNotFound();
    return entity;
  }

  /** El índice único de DNI es la garantía ante altas concurrentes. */
  private async translateConflicts(write: () => Promise<unknown>): Promise<void> {
    try {
      await write();
    } catch (error: unknown) {
      if (isDuplicateEntryError(error)) throw patientDniConflict();
      throw error;
    }
  }

  private async repository(): Promise<Repository<PatientEntity>> {
    return (await this.database.ensureInitialized()).getRepository(PatientEntity);
  }
}
