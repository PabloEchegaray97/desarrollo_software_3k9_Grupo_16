import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { escapeLikePattern, normalizeCatalogName } from './catalog-normalization.js';
import { ChairInputDto, ProcedureInputDto, SetActiveDto } from './dto/catalog.dto.js';
import { CatalogListQueryDto } from './paginated.js';

type Constructor<T> = new () => T;

function check<T extends object>(type: Constructor<T>, plain: Record<string, unknown>) {
  const instance = plainToInstance(type, plain);
  const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, invalidFields: errors.map((error) => error.property) };
}

const validProcedure = { nombre: 'Control ficticio', duracionPredeterminadaMinutos: 30 };

describe('normalización de catálogos', () => {
  it('recorta y colapsa espacios', () => {
    expect(normalizeCatalogName('  control   FICTICIO ')).toBe('control FICTICIO');
  });

  it('escapa los comodines de LIKE', () => {
    expect(escapeLikePattern('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });
});

describe('ProcedureInputDto', () => {
  it.each([1, 240])('acepta duración %i', (duration) => {
    expect(check(ProcedureInputDto, { ...validProcedure, duracionPredeterminadaMinutos: duration }).invalidFields).toEqual([]);
  });

  it.each([0, 241, 30.5, '30'])('rechaza duración %p', (duration) => {
    expect(check(ProcedureInputDto, { ...validProcedure, duracionPredeterminadaMinutos: duration }).invalidFields).toEqual([
      'duracionPredeterminadaMinutos',
    ]);
  });

  it.each([0, 30, null, undefined])('acepta intervalo %p', (interval) => {
    expect(check(ProcedureInputDto, { ...validProcedure, intervaloPosteriorMinutos: interval }).invalidFields).toEqual([]);
  });

  it.each([-1, 31, 2.5])('rechaza intervalo %p', (interval) => {
    expect(check(ProcedureInputDto, { ...validProcedure, intervaloPosteriorMinutos: interval }).invalidFields).toEqual([
      'intervaloPosteriorMinutos',
    ]);
  });

  it('normaliza el nombre y rechaza uno vacío tras recortar', () => {
    expect(check(ProcedureInputDto, { ...validProcedure, nombre: '  Control   ficticio ' }).instance.nombre).toBe(
      'Control ficticio',
    );
    expect(check(ProcedureInputDto, { ...validProcedure, nombre: '   ' }).invalidFields).toEqual(['nombre']);
  });

  it('rechaza campos no declarados', () => {
    expect(check(ProcedureInputDto, { ...validProcedure, activo: false }).invalidFields).toEqual(['activo']);
  });
});

describe('ChairInputDto y SetActiveDto', () => {
  it('exige nombre de hasta 60 caracteres', () => {
    expect(check(ChairInputDto, { nombre: 'Sillón 1' }).invalidFields).toEqual([]);
    expect(check(ChairInputDto, { nombre: 'x'.repeat(61) }).invalidFields).toEqual(['nombre']);
    expect(check(ChairInputDto, {}).invalidFields).toEqual(['nombre']);
  });

  it('exige activo booleano', () => {
    expect(check(SetActiveDto, { activo: false }).invalidFields).toEqual([]);
    expect(check(SetActiveDto, { activo: 'false' }).invalidFields).toEqual(['activo']);
  });
});

describe('CatalogListQueryDto', () => {
  it('aplica valores por defecto y convierte la query string', () => {
    const { instance, invalidFields } = check(CatalogListQueryDto, { incluirInactivos: 'true', page: '2' });
    expect(invalidFields).toEqual([]);
    expect(instance).toMatchObject({ incluirInactivos: true, page: 2, pageSize: 20 });
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ pageSize: '0' }, 'pageSize'],
    [{ pageSize: '101' }, 'pageSize'],
    [{ incluirInactivos: 'si' }, 'incluirInactivos'],
  ])('rechaza %p', (query, field) => {
    expect(check(CatalogListQueryDto, query).invalidFields).toEqual([field]);
  });

  it('acepta pageSize 100', () => {
    expect(check(CatalogListQueryDto, { pageSize: '100' }).invalidFields).toEqual([]);
  });
});
