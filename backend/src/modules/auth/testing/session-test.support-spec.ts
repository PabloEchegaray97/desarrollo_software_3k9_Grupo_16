/**
 * Soporte de pruebas de C-04 para cualquier suite que llame a la API protegida
 * (por ejemplo, el harness de integración de C-02, ver CR-C04-01). No es una suite.
 * Solo usa credenciales ficticias.
 */
import type { DataSource } from 'typeorm';
import { provisionInitialAccount } from '../account-provisioning.js';
import { normalizeEmail } from '../email-normalization.js';
import { ScryptPasswordHasher } from '../scrypt-password-hasher.js';
import { SessionTokenService, type Clock } from '../session-token.service.js';
import { SESSION_COOKIE_NAME } from '../session.contract.js';

/** Igual al `AUTH_SECRET` que usa el harness de integración existente. */
export const TEST_AUTH_SECRET = 'fictional-integration-secret-at-least-32-characters';

export const FICTIONAL_ACCOUNT = {
  email: 'odontologo.ficticio@example.test',
  password: 'contrasena-ficticia-123',
} as const;

/** Valor listo para la cabecera `Cookie` de Supertest. */
export function createSessionCookie(secret: string, userId: string, clock?: Clock): string {
  return `${SESSION_COOKIE_NAME}=${new SessionTokenService(secret, clock).sign(userId)}`;
}

/** Crea (o reutiliza) la cuenta ficticia y devuelve su id. */
export async function insertTestUser(
  dataSource: DataSource,
  email: string = FICTIONAL_ACCOUNT.email,
  password: string = FICTIONAL_ACCOUNT.password,
): Promise<string> {
  await provisionInitialAccount(dataSource, email, password, new ScryptPasswordHasher());
  const rows: Array<{ id: string }> = await dataSource.query('SELECT id FROM users WHERE email = ?', [
    normalizeEmail(email),
  ]);
  return rows[0].id;
}

/** Cookie de sesión válida para la cuenta ficticia. */
export async function authenticatedCookie(dataSource: DataSource, secret = TEST_AUTH_SECRET): Promise<string> {
  return createSessionCookie(secret, await insertTestUser(dataSource));
}
