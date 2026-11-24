import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { validationError } from '../lifecycle-errors.js';

/**
 * Paso 1 del algoritmo de C-06: validar el DTO antes de abrir la transacción.
 * El pipe HTTP ya valida, pero el servicio no depende de quién lo invoque.
 */
export async function validateLifecycleInput<T extends object>(type: ClassConstructor<T>, input: T): Promise<T> {
  // Siempre se reconstruye: el `@Transform` normaliza también si el caller pasó una instancia.
  const dto = plainToInstance(type, { ...input });
  const errors = await validate(dto);
  const first = errors[0];
  if (!first) return dto;
  const constraints = first.constraints;
  const message = constraints ? (Object.values(constraints)[0] ?? 'Datos inválidos') : 'Datos inválidos';
  throw validationError(first.property, message);
}
