import { jest } from '@jest/globals';
import { HttpStatus } from '@nestjs/common';
import { QueryFailedError, type DataSource } from 'typeorm';
import type { DatabaseConnectionService } from '../../database/database-connection.service.js';
import { CatalogError } from './catalog-errors.js';
import { CatalogReferences } from './catalog-references.js';
import { ChairEntity } from './chair.entity.js';
import { ChairsService } from './chairs.service.js';
import { ProcedureEntity } from './procedure.entity.js';
import { ProceduresService } from './procedures.service.js';

const PROCEDURE_ID = '1b0f8a52-7d0e-4b8e-9d3a-2f1c5e6a7b80';
const CHAIR_ID = '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91';
const createdAt = new Date('2026-11-24T12:00:00.000Z');

function procedureEntity(overrides: Partial<ProcedureEntity> = {}): ProcedureEntity {
  return Object.assign(new ProcedureEntity(), {
    id: PROCEDURE_ID,
    name: 'Control ficticio',
    defaultDurationMinutes: 30,
    postIntervalMinutes: null,
    active: true,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

function chairEntity(overrides: Partial<ChairEntity> = {}): ChairEntity {
  return Object.assign(new ChairEntity(), {
    id: CHAIR_ID,
    name: 'Sillón 1',
    active: true,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

function duplicateEntryError(): QueryFailedError {
  return new QueryFailedError('INSERT', [], Object.assign(new Error('Duplicate entry'), { errno: 1062 }));
}

interface RepositoryMock {
  findOneBy: jest.Mock<(where: { id: string }) => Promise<unknown>>;
  insert: jest.Mock<(values: unknown) => Promise<unknown>>;
  update: jest.Mock<(criteria: unknown, values: unknown) => Promise<unknown>>;
}

function repositoryMock(): RepositoryMock {
  return {
    findOneBy: jest.fn<(where: { id: string }) => Promise<unknown>>(),
    insert: jest.fn<(values: unknown) => Promise<unknown>>().mockResolvedValue({}),
    update: jest.fn<(criteria: unknown, values: unknown) => Promise<unknown>>().mockResolvedValue({}),
  };
}

function databaseWith(repository: RepositoryMock, manager: object = {}): DatabaseConnectionService {
  const dataSource = { getRepository: () => repository, manager } as unknown as DataSource;
  return { ensureInitialized: async () => dataSource } as unknown as DatabaseConnectionService;
}

async function expectCatalogError(promise: Promise<unknown>, code: string, status: HttpStatus) {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(CatalogError);
  expect((error as CatalogError).code).toBe(code);
  expect((error as CatalogError).getStatus()).toBe(status);
  expect((error as CatalogError).getResponse()).toEqual({ code, message: expect.any(String) });
}

describe('ProceduresService', () => {
  it('crea la prestación activa y guarda null cuando no hay intervalo propio', async () => {
    const repository = repositoryMock();
    repository.findOneBy.mockResolvedValue(procedureEntity());
    const service = new ProceduresService(databaseWith(repository));

    const result = await service.create({ nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30 });

    expect(repository.insert).toHaveBeenCalledWith({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Control ficticio',
      defaultDurationMinutes: 30,
      postIntervalMinutes: null,
      active: true,
    });
    expect(result).toEqual({
      id: PROCEDURE_ID,
      nombre: 'Control ficticio',
      duracionPredeterminadaMinutos: 30,
      intervaloPosteriorMinutos: null,
      activo: true,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('traduce un nombre duplicado a PROCEDURE_NAME_CONFLICT', async () => {
    const repository = repositoryMock();
    repository.insert.mockRejectedValue(duplicateEntryError());
    const service = new ProceduresService(databaseWith(repository));

    await expectCatalogError(
      service.create({ nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30 }),
      'PROCEDURE_NAME_CONFLICT',
      HttpStatus.CONFLICT,
    );
  });

  it('propaga errores de base que no son de duplicado', async () => {
    const repository = repositoryMock();
    const failure = new Error('connection lost');
    repository.insert.mockRejectedValue(failure);
    const service = new ProceduresService(databaseWith(repository));

    await expect(service.create({ nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30 })).rejects.toBe(failure);
  });

  it('responde PROCEDURE_NOT_FOUND al editar o cambiar estado de un id inexistente', async () => {
    const repository = repositoryMock();
    repository.findOneBy.mockResolvedValue(null);
    const service = new ProceduresService(databaseWith(repository));

    await expectCatalogError(
      service.replace(PROCEDURE_ID, { nombre: 'Otra', duracionPredeterminadaMinutos: 20 }),
      'PROCEDURE_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );
    await expectCatalogError(service.setActive(PROCEDURE_ID, false), 'PROCEDURE_NOT_FOUND', HttpStatus.NOT_FOUND);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('el reemplazo completo deja en null el intervalo omitido', async () => {
    const repository = repositoryMock();
    repository.findOneBy.mockResolvedValue(procedureEntity({ postIntervalMinutes: 5 }));
    const service = new ProceduresService(databaseWith(repository));

    await service.replace(PROCEDURE_ID, { nombre: 'Control ficticio', duracionPredeterminadaMinutos: 45 });

    expect(repository.update).toHaveBeenCalledWith(
      { id: PROCEDURE_ID },
      { name: 'Control ficticio', defaultDurationMinutes: 45, postIntervalMinutes: null },
    );
  });
});

describe('ChairsService', () => {
  it('traduce un nombre duplicado a CHAIR_NAME_CONFLICT al editar', async () => {
    const repository = repositoryMock();
    repository.findOneBy.mockResolvedValue(chairEntity());
    repository.update.mockRejectedValue(duplicateEntryError());
    const service = new ChairsService(databaseWith(repository));

    await expectCatalogError(service.replace(CHAIR_ID, { nombre: 'Sillón 2' }), 'CHAIR_NAME_CONFLICT', HttpStatus.CONFLICT);
  });

  it('desactiva sin borrar y devuelve activo false', async () => {
    const repository = repositoryMock();
    repository.findOneBy.mockResolvedValueOnce(chairEntity()).mockResolvedValueOnce(chairEntity({ active: false }));
    const service = new ChairsService(databaseWith(repository));

    const result = await service.setActive(CHAIR_ID, false);

    expect(repository.update).toHaveBeenCalledWith({ id: CHAIR_ID }, { active: false });
    expect(result.activo).toBe(false);
  });

  it('responde CHAIR_NOT_FOUND para un id inexistente', async () => {
    const repository = repositoryMock();
    repository.findOneBy.mockResolvedValue(null);
    await expectCatalogError(new ChairsService(databaseWith(repository)).findById(CHAIR_ID), 'CHAIR_NOT_FOUND', HttpStatus.NOT_FOUND);
  });
});

describe('CatalogReferences', () => {
  function managerReturning(entity: object | null) {
    return { findOneBy: jest.fn(async () => entity) };
  }

  it('expone duración, intervalo null y estado de una prestación', async () => {
    const manager = managerReturning(procedureEntity({ active: false }));
    const references = new CatalogReferences(databaseWith(repositoryMock(), manager));

    await expect(references.findProcedureById(PROCEDURE_ID)).resolves.toEqual({
      id: PROCEDURE_ID,
      nombre: 'Control ficticio',
      activo: false,
      duracionPredeterminadaMinutos: 30,
      intervaloPosteriorMinutos: null,
    });
  });

  it('usa el EntityManager de la transacción del consumidor cuando se provee', async () => {
    const defaultManager = managerReturning(null);
    const transactionManager = managerReturning(chairEntity({ active: false }));
    const references = new CatalogReferences(databaseWith(repositoryMock(), defaultManager));

    await expect(
      references.findChairById(CHAIR_ID, transactionManager as unknown as import('typeorm').EntityManager),
    ).resolves.toEqual({ id: CHAIR_ID, nombre: 'Sillón 1', activo: false });
    expect(defaultManager.findOneBy).not.toHaveBeenCalled();
  });

  it('devuelve null para ids inexistentes', async () => {
    const references = new CatalogReferences(databaseWith(repositoryMock(), managerReturning(null)));
    await expect(references.findProcedureById(PROCEDURE_ID)).resolves.toBeNull();
    await expect(references.findChairById(CHAIR_ID)).resolves.toBeNull();
  });
});
