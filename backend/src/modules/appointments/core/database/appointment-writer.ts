import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { AppointmentEventEntity } from '../entities/appointment-event.entity.js';
import { AppointmentEntity } from '../entities/appointment.entity.js';

export type NewAppointment = Omit<AppointmentEntity, 'patient' | 'procedure' | 'chair' | 'createdAt' | 'updatedAt'>;
export type NewAppointmentEvent = Omit<AppointmentEventEntity, 'appointment'>;

/**
 * Escritura de turnos y eventos dentro de la transacción del caso de uso.
 * Inyectable para que las pruebas de atomicidad simulen un fallo del historial.
 */
@Injectable()
export class AppointmentWriter {
  async insertAppointment(manager: EntityManager, appointment: NewAppointment): Promise<void> {
    await manager.insert(AppointmentEntity, appointment);
  }

  async insertEvents(manager: EntityManager, events: readonly NewAppointmentEvent[]): Promise<void> {
    if (events.length === 0) return;
    await manager.insert(AppointmentEventEntity, [...events]);
  }

  async findAppointment(manager: EntityManager, id: string): Promise<AppointmentEntity> {
    return manager.findOneByOrFail(AppointmentEntity, { id });
  }
}
