import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { normalizeEmail } from './email-normalization.js';
import type { PasswordHasher } from './password-hasher.contract.js';

export type ProvisioningOutcome = 'created' | 'existing';

interface DriverError {
  readonly code?: string;
  readonly driverError?: { readonly code?: string };
}

const driverCode = (error: unknown): string | undefined => {
  const candidate = error as DriverError;
  return candidate.driverError?.code ?? candidate.code;
};

export class MissingUsersTableError extends Error {
  constructor() {
    super('La tabla users no existe. Ejecutar primero: npm run migration:run');
    this.name = 'MissingUsersTableError';
  }
}

/** Crea la cuenta única si el email normalizado no existe; nunca modifica una cuenta existente. */
export async function provisionInitialAccount(
  dataSource: DataSource,
  email: string,
  password: string,
  hasher: PasswordHasher,
): Promise<ProvisioningOutcome> {
  const normalized = normalizeEmail(email);
  try {
    const existing: unknown[] = await dataSource.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalized]);
    if (existing.length > 0) return 'existing';
    const passwordHash = await hasher.hash(password);
    await dataSource.query('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [
      randomUUID(),
      normalized,
      passwordHash,
    ]);
    return 'created';
  } catch (error) {
    const code = driverCode(error);
    if (code === 'ER_DUP_ENTRY') return 'existing';
    if (code === 'ER_NO_SUCH_TABLE') throw new MissingUsersTableError();
    throw error;
  }
}
