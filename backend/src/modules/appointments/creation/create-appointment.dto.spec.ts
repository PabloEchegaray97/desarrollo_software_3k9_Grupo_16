import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';

const valid = {
  pacienteId: '3d2a0c74-9f20-4da0-9f5c-4b3e7a8c9d02',
  prestacionId: '1b0f8a52-7d0e-4b8e-9d3a-2f1c5e6a7b80',
  sillonId: '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91',
  fecha: '2027-03-10',
  horaInicio: '10:00',
};

function check(plain: Record<string, unknown>) {
  const instance = plainToInstance(CreateAppointmentDto, plain);
  const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, invalidFields: errors.map((error) => error.property).sort() };
}

describe('CreateAppointmentDto', () => {
  it('acepta un alta mínima sin sobrescrituras ni excepción', () => {
    expect(check(valid).invalidFields).toEqual([]);
  });

  it.each(['pacienteId', 'prestacionId', 'sillonId', 'fecha', 'horaInicio'])('exige %s', (field) => {
    const plain: Record<string, unknown> = { ...valid };
    delete plain[field];
    expect(check(plain).invalidFields).toEqual([field]);
  });

  it.each([
    ['pacienteId', 'no-es-uuid'],
    ['fecha', '10/03/2027'],
    ['fecha', '2027-3-10'],
    ['horaInicio', '9:00'],
    ['horaInicio', '24:00'],
    ['horaInicio', '10:60'],
    ['horaInicio', '10:00:00'],
  ])('rechaza %s con formato inválido %p', (field, value) => {
    expect(check({ ...valid, [field]: value }).invalidFields).toEqual([field]);
  });

  it.each([1, 240])('acepta duración %i', (duracionMinutos) => {
    expect(check({ ...valid, duracionMinutos }).invalidFields).toEqual([]);
  });

  it.each([0, 241, 30.5, '30'])('rechaza duración %p', (duracionMinutos) => {
    expect(check({ ...valid, duracionMinutos }).invalidFields).toEqual(['duracionMinutos']);
  });

  it.each([0, 30])('acepta intervalo %i', (intervaloPosteriorMinutos) => {
    expect(check({ ...valid, intervaloPosteriorMinutos }).invalidFields).toEqual([]);
  });

  it.each([-1, 31, 2.5])('rechaza intervalo %p', (intervaloPosteriorMinutos) => {
    expect(check({ ...valid, intervaloPosteriorMinutos }).invalidFields).toEqual(['intervaloPosteriorMinutos']);
  });

  describe('motivo condicional', () => {
    it('exige motivo cuando fueraDisponibilidad es true', () => {
      expect(check({ ...valid, fueraDisponibilidad: true }).invalidFields).toEqual(['motivoExcepcion']);
    });

    it('rechaza un motivo vacío tras recortar o mayor a 500', () => {
      expect(check({ ...valid, fueraDisponibilidad: true, motivoExcepcion: '   ' }).invalidFields).toEqual(['motivoExcepcion']);
      expect(check({ ...valid, fueraDisponibilidad: true, motivoExcepcion: 'x'.repeat(501) }).invalidFields).toEqual(['motivoExcepcion']);
    });

    it('acepta y recorta el motivo con override', () => {
      const { instance, invalidFields } = check({ ...valid, fueraDisponibilidad: true, motivoExcepcion: '  Urgencia ficticia  ' });
      expect(invalidFields).toEqual([]);
      expect(instance.motivoExcepcion).toBe('Urgencia ficticia');
    });

    it('no exige motivo sin override', () => {
      expect(check({ ...valid, fueraDisponibilidad: false }).invalidFields).toEqual([]);
    });

    it('rechaza fueraDisponibilidad no booleano', () => {
      expect(check({ ...valid, fueraDisponibilidad: 'si', motivoExcepcion: 'Urgencia ficticia' }).invalidFields).toEqual(['fueraDisponibilidad']);
    });
  });

  it('rechaza campos no declarados como estado o fines calculados', () => {
    expect(check({ ...valid, estado: 'CONFIRMADO', finBloqueo: '2027-03-10T14:00:00Z' }).invalidFields).toEqual(['estado', 'finBloqueo']);
  });
});
