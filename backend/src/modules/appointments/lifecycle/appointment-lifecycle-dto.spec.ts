import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import { ChangeAppointmentStatusDto } from './dto/change-appointment-status.dto.js';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto.js';

function check<T extends object>(type: new () => T, plain: Record<string, unknown>) {
  const instance = plainToInstance(type, plain);
  const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, invalidFields: errors.map((error) => error.property).sort() };
}

const validReschedule = {
  fecha: '2027-03-10',
  horaInicio: '10:00',
  motivo: 'Motivo ficticio',
};

describe('RescheduleAppointmentDto', () => {
  it('normaliza el motivo de reprogramación', () => {
    const { instance, invalidFields } = check(RescheduleAppointmentDto, {
      ...validReschedule,
      motivo: '  Motivo\t\n  ficticio  ',
    });
    expect(invalidFields).toEqual([]);
    expect(instance.motivo).toBe('Motivo ficticio');
  });

  it('acepta motivos de 1 y 500 caracteres normalizados', () => {
    expect(check(RescheduleAppointmentDto, { ...validReschedule, motivo: 'x' }).invalidFields).toEqual([]);
    expect(check(RescheduleAppointmentDto, { ...validReschedule, motivo: 'x'.repeat(500) }).invalidFields).toEqual([]);
  });

  it('rechaza motivo ausente, vacío, solo espacios y mayor a 500', () => {
    const withoutReason: Record<string, unknown> = { ...validReschedule };
    delete withoutReason.motivo;
    expect(check(RescheduleAppointmentDto, withoutReason).invalidFields).toEqual(['motivo']);
    for (const motivo of ['', '   \t\n ', 'x'.repeat(501)]) {
      expect(check(RescheduleAppointmentDto, { ...validReschedule, motivo }).invalidFields).toEqual(['motivo']);
    }
  });

  it.each([
    ['fecha', '10/03/2027'],
    ['fecha', '2027-3-10'],
    ['horaInicio', '9:00'],
    ['horaInicio', '24:00'],
    ['horaInicio', '10:60'],
    ['sillonId', 'no-es-uuid'],
  ])('rechaza %s con valor %p', (field, value) => {
    expect(check(RescheduleAppointmentDto, { ...validReschedule, [field]: value }).invalidFields).toEqual([field]);
  });

  it('acepta un sillón opcional válido y rechaza campos no declarados', () => {
    const sillonId = '2c1f9b63-8e1f-4c9f-8e4b-3a2d6f7b8c91';
    expect(check(RescheduleAppointmentDto, { ...validReschedule, sillonId }).invalidFields).toEqual([]);
    expect(check(RescheduleAppointmentDto, { ...validReschedule, estado: 'CONFIRMADO' }).invalidFields).toEqual(['estado']);
  });

  it('exige motivo de excepción solo con fueraDisponibilidad=true', () => {
    expect(check(RescheduleAppointmentDto, { ...validReschedule, fueraDisponibilidad: true }).invalidFields).toEqual([
      'motivoExcepcion',
    ]);
    const { instance, invalidFields } = check(RescheduleAppointmentDto, {
      ...validReschedule,
      fueraDisponibilidad: true,
      motivoExcepcion: '  Choque\t con  feriado  ',
    });
    expect(invalidFields).toEqual([]);
    expect(instance.motivoExcepcion).toBe('Choque con feriado');
    expect(check(RescheduleAppointmentDto, { ...validReschedule, fueraDisponibilidad: 'si' }).invalidFields).toEqual([
      'fueraDisponibilidad',
    ]);
  });
});

describe('CancelAppointmentDto', () => {
  it('normaliza y exige el motivo de cancelación', () => {
    const { instance, invalidFields } = check(CancelAppointmentDto, { motivo: '  Motivo\t de  cancelación  ' });
    expect(invalidFields).toEqual([]);
    expect(instance.motivo).toBe('Motivo de cancelación');
  });

  it('acepta 1 y 500 caracteres y rechaza ausente, vacío y 501', () => {
    expect(check(CancelAppointmentDto, { motivo: 'x' }).invalidFields).toEqual([]);
    expect(check(CancelAppointmentDto, { motivo: 'x'.repeat(500) }).invalidFields).toEqual([]);
    expect(check(CancelAppointmentDto, {}).invalidFields).toEqual(['motivo']);
    expect(check(CancelAppointmentDto, { motivo: '\t \n' }).invalidFields).toEqual(['motivo']);
    expect(check(CancelAppointmentDto, { motivo: 'x'.repeat(501) }).invalidFields).toEqual(['motivo']);
  });
});

describe('ChangeAppointmentStatusDto', () => {
  it('acepta solo los estados alcanzables por /estado', () => {
    for (const estado of ['CONFIRMADO', 'ATENDIDO', 'AUSENTE']) {
      const { instance, invalidFields } = check(ChangeAppointmentStatusDto, { estado });
      expect(invalidFields).toEqual([]);
      expect(instance.estado).toBe(estado);
    }
  });

  it.each(['CANCELADO', 'PROGRAMADO', 'ESTADO_NO_RECONOCIDO', '', 7])(
    'rechaza el estado %p',
    (estado) => {
      expect(check(ChangeAppointmentStatusDto, { estado }).invalidFields).toEqual(['estado']);
    },
  );

  it('exige estado y rechaza campos no declarados', () => {
    expect(check(ChangeAppointmentStatusDto, {}).invalidFields).toEqual(['estado']);
    expect(check(ChangeAppointmentStatusDto, { estado: 'CONFIRMADO', motivo: 'extra' }).invalidFields).toEqual(['motivo']);
  });
});
