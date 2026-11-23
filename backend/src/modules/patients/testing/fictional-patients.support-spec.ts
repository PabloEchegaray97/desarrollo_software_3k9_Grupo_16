/**
 * Fixtures exclusivamente ficticios para las pruebas de C-02 (RN-PA-07).
 * Nombres evidentemente ficticios, teléfonos en el rango 5555, DNI de prueba
 * 3000000N y emails del dominio reservado `example.test`.
 */
export interface FictionalPatientInput {
  nombre: string;
  telefono: string;
  dni?: string | null;
  email?: string | null;
  confirmarPosibleDuplicado?: boolean;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function fictionalPatient(index: number, overrides: Partial<FictionalPatientInput> = {}): FictionalPatientInput {
  return {
    nombre: `Paciente Ficticio ${index}`,
    telefono: `11 5555-00${pad(index)}`,
    ...overrides,
  };
}

export const fictionalDni = (index: number): string => `3000000${index}`;
export const fictionalEmail = (index: number): string => `paciente${index}@example.test`;
