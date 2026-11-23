import { jest } from '@jest/globals';
import { HttpStatus } from '@nestjs/common';
import { FindOperator, QueryFailedError, type DataSource, type EntityManager } from 'typeorm';
import type { DatabaseConnectionService } from '../../database/database-connection.service.js';
import type { PatientInputDto } from './dto/patient.dto.js';
import { PatientError } from './patient-errors.js';
import { PatientReferences } from './patient-references.js';
import { PatientEntity } from './patient.entity.js';
import { PatientsService } from './patients.service.js';

const PATIENT_ID = '3d2a0c74-9f20-4da0-9f5c-4b3e7a8c9d02';
const OTHER_ID = '4e3b1d85-a031-4eb1-a06d-5c4f8b9dae13';
const createdAt = new Date('2026-11-24T12:00:00.000Z');

function patientEntity(overrides: Partial<PatientEntity> = {}): PatientEntity {
  return Object.assign(new PatientEntity(), {
    id: PATIENT_ID,
    name: 'Paciente Ficticio Uno',
    phone: '11 5555-0001',
    phoneDigits: '1155550001',
    dni: null,
    email: null,
    active: true,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

const input = (overrides: Partial<PatientInputDto> = {}): PatientInputDto =>
  Object.assign(new (class {})() as PatientInputDto, {
    nombre: 'Paciente Ficticio Uno',
    telefono: '11 5555-0001',
    ...overrides,
  });

interface FindOptions {
  where: Record<string, unknown>;
}

function setup() {
  const repository = {
    findOneBy: jest.fn<(where: { id: string }) => Promise<PatientEntity | null>>(),
    find: jest.fn<(options: FindOptions) => Promise<PatientEntity[]>>().mockResolvedValue([]),
    insert: jest.fn<(values: unknown) => Promise<unknown>>().mockResolvedValue({}),
    update: jest.fn<(criteria: unknown, values: unknown) => Promise<unknown>>().mockResolvedValue({}),
  };
  const dataSource = { getRepository: () => repository } as unknown as DataSource;
  const database = { ensureInitialized: async () => dataSource } as unknown as DatabaseConnectionService;
  return { repository, service: new PatientsService(database) };
}

async function caughtPatientError(promise: Promise<unknown>): Promise<PatientError> {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(PatientError);
  return error as PatientError;
}

describe('PatientsService — alta', () => {
  it('crea un paciente activo con DNI y email null y los dígitos del teléfono', async () => {
    const { repository, service } = setup();
    repository.findOneBy.mockResolvedValue(patientEntity());

    const result = await service.create(input());

    expect(repository.insert).toHaveBeenCalledWith({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Paciente Ficticio Uno',
      phone: '11 5555-0001',
      phoneDigits: '1155550001',
      dni: null,
      email: null,
      active: true,
    });
    expect(result).toMatchObject({ nombre: 'Paciente Ficticio Uno', dni: null, email: null, activo: true });
  });

  it('busca coincidencias por nombre y dígitos del teléfono', async () => {
    const { repository, service } = setup();
    repository.findOneBy.mockResolvedValue(patientEntity());

    await service.create(input({ nombre: 'paciente ficticio uno', telefono: '1155550001' }));

    expect(repository.find.mock.calls[0]?.[0].where).toEqual({
      name: 'paciente ficticio uno',
      phoneDigits: '1155550001',
    });
  });

  it('advierte un posible duplicado con candidatos mínimos y no inserta', async () => {
    const { repository, service } = setup();
    repository.find.mockResolvedValue([patientEntity({ id: OTHER_ID, dni: '30000001', email: 'uno@example.test' })]);

    const error = await caughtPatientError(service.create(input()));

    expect(error.code).toBe('PATIENT_POSSIBLE_DUPLICATE');
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.getResponse()).toEqual({
      code: 'PATIENT_POSSIBLE_DUPLICATE',
      message: expect.any(String),
      details: { candidatos: [{ id: OTHER_ID, nombre: 'Paciente Ficticio Uno', activo: true }] },
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('crea igual cuando se confirma el posible duplicado, sin volver a buscar', async () => {
    const { repository, service } = setup();
    repository.find.mockResolvedValue([patientEntity({ id: OTHER_ID })]);
    repository.findOneBy.mockResolvedValue(patientEntity());

    await service.create(input({ confirmarPosibleDuplicado: true }));

    expect(repository.find).not.toHaveBeenCalled();
    expect(repository.insert).toHaveBeenCalled();
    expect(repository.insert.mock.calls[0]?.[0]).not.toHaveProperty('confirmarPosibleDuplicado');
  });

  it('traduce el índice único de DNI a PATIENT_DNI_CONFLICT', async () => {
    const { repository, service } = setup();
    repository.insert.mockRejectedValue(
      new QueryFailedError('INSERT', [], Object.assign(new Error('Duplicate entry'), { errno: 1062 })),
    );

    const error = await caughtPatientError(service.create(input({ dni: '30000001' })));

    expect(error.code).toBe('PATIENT_DNI_CONFLICT');
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
  });
});

describe('PatientsService — edición y estado', () => {
  it('no exige confirmación si nombre y teléfono no cambian (mayúsculas o formato)', async () => {
    const { repository, service } = setup();
    repository.findOneBy.mockResolvedValue(patientEntity());
    repository.find.mockResolvedValue([patientEntity({ id: OTHER_ID })]);

    await service.replace(PATIENT_ID, input({ nombre: 'PACIENTE FICTICIO UNO', telefono: '1155550001', email: 'nuevo@example.test' }));

    expect(repository.find).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith({ id: PATIENT_ID }, expect.objectContaining({ email: 'nuevo@example.test' }));
  });

  it('reevalúa duplicados excluyendo al propio paciente cuando cambia el teléfono', async () => {
    const { repository, service } = setup();
    repository.findOneBy.mockResolvedValue(patientEntity());
    repository.find.mockResolvedValue([patientEntity({ id: OTHER_ID, phoneDigits: '1155550002' })]);

    const error = await caughtPatientError(service.replace(PATIENT_ID, input({ telefono: '11 5555-0002' })));

    expect(error.code).toBe('PATIENT_POSSIBLE_DUPLICATE');
    const where = repository.find.mock.calls[0]?.[0].where ?? {};
    expect(where.id).toBeInstanceOf(FindOperator);
    expect((where.id as FindOperator<string>).type).toBe('not');
    expect((where.id as FindOperator<string>).value).toBe(PATIENT_ID);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('vuelve a comprobar unicidad de DNI al editar', async () => {
    const { repository, service } = setup();
    repository.findOneBy.mockResolvedValue(patientEntity());
    repository.update.mockRejectedValue(
      new QueryFailedError('UPDATE', [], Object.assign(new Error('Duplicate entry'), { errno: 1062 })),
    );

    expect((await caughtPatientError(service.replace(PATIENT_ID, input({ dni: '30000001' })))).code).toBe(
      'PATIENT_DNI_CONFLICT',
    );
  });

  it('responde PATIENT_NOT_FOUND para ids inexistentes', async () => {
    const { repository, service } = setup();
    repository.findOneBy.mockResolvedValue(null);

    for (const operation of [
      service.findById(PATIENT_ID),
      service.replace(PATIENT_ID, input()),
      service.setActive(PATIENT_ID, false),
    ]) {
      const error = await caughtPatientError(operation);
      expect(error.code).toBe('PATIENT_NOT_FOUND');
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('desactiva sin borrar', async () => {
    const { repository, service } = setup();
    repository.findOneBy.mockResolvedValueOnce(patientEntity()).mockResolvedValueOnce(patientEntity({ active: false }));

    await expect(service.setActive(PATIENT_ID, false)).resolves.toMatchObject({ activo: false });
    expect(repository.update).toHaveBeenCalledWith({ id: PATIENT_ID }, { active: false });
  });
});

describe('PatientReferences', () => {
  it('devuelve id, nombre y estado, usando el EntityManager provisto', async () => {
    const ensureInitialized = jest.fn();
    const database = { ensureInitialized } as unknown as DatabaseConnectionService;
    const manager = { findOneBy: jest.fn(async () => patientEntity({ active: false })) } as unknown as EntityManager;

    await expect(new PatientReferences(database).findById(PATIENT_ID, manager)).resolves.toEqual({
      id: PATIENT_ID,
      nombre: 'Paciente Ficticio Uno',
      activo: false,
    });
    expect(ensureInitialized).not.toHaveBeenCalled();
  });

  it('devuelve null para un id inexistente', async () => {
    const manager = { findOneBy: jest.fn(async () => null) };
    const dataSource = { manager } as unknown as DataSource;
    const database = { ensureInitialized: async () => dataSource } as unknown as DatabaseConnectionService;

    await expect(new PatientReferences(database).findById(PATIENT_ID)).resolves.toBeNull();
  });
});
