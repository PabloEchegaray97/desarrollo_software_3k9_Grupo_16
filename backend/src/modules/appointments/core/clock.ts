/** Reloj del servidor reemplazable en pruebas: la política nunca lee la hora del sistema. */
export const APPOINTMENT_CLOCK = Symbol('APPOINTMENT_CLOCK');

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Reloj fijo para pruebas. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(instant: Date): void {
    this.current = new Date(instant.getTime());
  }
}
