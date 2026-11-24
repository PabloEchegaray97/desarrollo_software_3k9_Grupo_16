import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AgendaQueryDto } from './agenda-query.dto.js';

const CHAIR_ID = '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91';

function check(plain: Record<string, unknown>) {
  const instance = plainToInstance(AgendaQueryDto, plain);
  const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, invalidFields: errors.map((error) => error.property).sort() };
}

describe('AgendaQueryDto', () => {
  it('acepta solo desde', () => {
    expect(check({ desde: '2027-03-10' }).invalidFields).toEqual([]);
  });

  it('acepta desde, hasta, sillón y estados', () => {
    const { instance, invalidFields } = check({
      desde: '2027-03-10',
      hasta: '2027-03-12',
      sillonId: CHAIR_ID,
      estado: 'PROGRAMADO,CONFIRMADO',
    });
    expect(invalidFields).toEqual([]);
    expect(instance.estado).toEqual(['PROGRAMADO', 'CONFIRMADO']);
  });

  it('acepta estados repetidos como arreglo y tolera espacios', () => {
    const { instance, invalidFields } = check({ desde: '2027-03-10', estado: ['PROGRAMADO', ' ATENDIDO , AUSENTE'] });
    expect(invalidFields).toEqual([]);
    expect(instance.estado).toEqual(['PROGRAMADO', 'ATENDIDO', 'AUSENTE']);
  });

  it('exige desde', () => {
    expect(check({}).invalidFields).toEqual(['desde']);
  });

  it.each([
    ['desde', '10/03/2027'],
    ['desde', '2027-3-10'],
    ['desde', ''],
    ['hasta', 'mañana'],
    ['hasta', '2027-03-10T00:00'],
    ['sillonId', 'abc'],
  ])('rechaza %s con valor inválido %p', (field, value) => {
    expect(check({ desde: '2027-03-10', [field]: value }).invalidFields).toEqual([field]);
  });

  it.each(['PENDIENTE', 'programado', '', 'PROGRAMADO,', ',', 'PROGRAMADO,XX'])('rechaza el estado %p', (estado) => {
    expect(check({ desde: '2027-03-10', estado }).invalidFields).toEqual(['estado']);
  });

  it('rechaza parámetros no documentados', () => {
    expect(check({ desde: '2027-03-10', pagina: '2' }).invalidFields).toEqual(['pagina']);
  });
});
