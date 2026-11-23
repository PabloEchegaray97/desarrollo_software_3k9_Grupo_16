import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PatientInputDto, PatientListQueryDto } from './dto/patient.dto.js';
import { digitSearchTerm, escapeLikePattern, normalizeDni, normalizeEmail, normalizePatientName, phoneDigits } from './patient-normalization.js';

type Constructor<T> = new () => T;

function check<T extends object>(type: Constructor<T>, plain: Record<string, unknown>) {
  const instance = plainToInstance(type, plain);
  const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, invalidFields: errors.map((error) => error.property) };
}

const validPatient = { nombre: 'Paciente Ficticio Uno', telefono: '11 5555-0001' };

describe('normalización de pacientes', () => {
  it('recorta y colapsa espacios del nombre', () => {
    expect(normalizePatientName('  Paciente   Ficticio  Dos ')).toBe('Paciente Ficticio Dos');
  });

  it('extrae los dígitos del teléfono', () => {
    expect(phoneDigits('+54 (11) 5555-0001')).toBe('541155550001');
  });

  it.each([
    ['30.000.001', '30000001'],
    ['30 000 001', '30000001'],
    ['30-000-001', '30000001'],
    ['', null],
    ['  ', null],
    [null, null],
    [undefined, null],
  ])('normaliza el DNI %p', (raw, expected) => {
    expect(normalizeDni(raw)).toBe(expected);
  });

  it.each([
    [' Paciente.Uno@Example.TEST ', 'paciente.uno@example.test'],
    ['', null],
    [null, null],
  ])('normaliza el email %p', (raw, expected) => {
    expect(normalizeEmail(raw)).toBe(expected);
  });

  it.each([
    ['5555-0001', '55550001'],
    ['30.000.001', '30000001'],
    ['+54 (11) 5555', '54115555'],
    ['Ficticio 1', null],
    ['ficticio', null],
    ['- .', null],
  ])('decide la búsqueda por dígitos para %p', (query, expected) => {
    expect(digitSearchTerm(query)).toBe(expected);
  });

  it('escapa comodines de LIKE', () => {
    expect(escapeLikePattern('a%b_c')).toBe('a\\%b\\_c');
  });
});

describe('PatientInputDto', () => {
  it('acepta solo nombre y teléfono, y normaliza el nombre', () => {
    const { instance, invalidFields } = check(PatientInputDto, { ...validPatient, nombre: '  Paciente   Ficticio  Dos ' });
    expect(invalidFields).toEqual([]);
    expect(instance.nombre).toBe('Paciente Ficticio Dos');
    expect(instance.dni).toBeUndefined();
  });

  it.each([
    [{ telefono: '11 5555-0001' }, 'nombre'],
    [{ nombre: 'Paciente Ficticio Uno' }, 'telefono'],
    [{ ...validPatient, nombre: '   ' }, 'nombre'],
    [{ ...validPatient, telefono: '   ' }, 'telefono'],
  ])('rechaza datos obligatorios faltantes %p', (plain, field) => {
    expect(check(PatientInputDto, plain).invalidFields).toEqual([field]);
  });

  it.each(['11 5555-0001', '+54 (11) 5555-0001', '555500'])('acepta el teléfono %p', (telefono) => {
    expect(check(PatientInputDto, { ...validPatient, telefono }).invalidFields).toEqual([]);
  });

  it.each(['llamar al consultorio', '55550', '1'.repeat(21), '11/5555/0001'])('rechaza el teléfono %p', (telefono) => {
    expect(check(PatientInputDto, { ...validPatient, telefono }).invalidFields).toEqual(['telefono']);
  });

  it.each([
    ['30.000.001', '30000001'],
    ['3000001', '3000001'],
    ['', null],
  ])('acepta y normaliza el DNI %p', (dni, expected) => {
    const { instance, invalidFields } = check(PatientInputDto, { ...validPatient, dni });
    expect(invalidFields).toEqual([]);
    expect(instance.dni).toBe(expected);
  });

  it.each(['12A45', '123456', '123456789'])('rechaza el DNI %p', (dni) => {
    expect(check(PatientInputDto, { ...validPatient, dni }).invalidFields).toEqual(['dni']);
  });

  it('rechaza un email inválido y trata el vacío como omitido', () => {
    expect(check(PatientInputDto, { ...validPatient, email: 'no-es-un-email' }).invalidFields).toEqual(['email']);
    const { instance, invalidFields } = check(PatientInputDto, { ...validPatient, email: '' });
    expect(invalidFields).toEqual([]);
    expect(instance.email).toBeNull();
  });

  it('acepta confirmarPosibleDuplicado booleano y rechaza campos desconocidos', () => {
    expect(check(PatientInputDto, { ...validPatient, confirmarPosibleDuplicado: true }).invalidFields).toEqual([]);
    expect(check(PatientInputDto, { ...validPatient, confirmarPosibleDuplicado: 'si' }).invalidFields).toEqual([
      'confirmarPosibleDuplicado',
    ]);
    expect(check(PatientInputDto, { ...validPatient, activo: false }).invalidFields).toEqual(['activo']);
  });
});

describe('PatientListQueryDto', () => {
  it('aplica valores por defecto', () => {
    expect(check(PatientListQueryDto, {}).instance).toMatchObject({ page: 1, pageSize: 20 });
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ pageSize: '500' }, 'pageSize'],
  ])('rechaza %p', (query, field) => {
    expect(check(PatientListQueryDto, query).invalidFields).toEqual([field]);
  });
});
