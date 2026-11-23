import type { CookieOptions } from 'express';
import type { AppEnvironment } from '../../config/env.validation.js';
import { SESSION_COOKIE_CONTRACT, SESSION_COOKIE_NAME } from './session.contract.js';

type AppEnv = AppEnvironment['APP_ENV'];

/** Lee la cookie de sesión desde la cabecera `Cookie` sin depender de `cookie-parser`. */
export function readSessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

export function sessionCookieOptions(appEnv: AppEnv): CookieOptions {
  return {
    httpOnly: SESSION_COOKIE_CONTRACT.httpOnly,
    sameSite: SESSION_COOKIE_CONTRACT.sameSite,
    secure: SESSION_COOKIE_CONTRACT.secureInProduction && appEnv === 'production',
    path: '/',
    maxAge: SESSION_COOKIE_CONTRACT.ttlSeconds * 1000,
  };
}

export function clearedSessionCookieOptions(appEnv: AppEnv): CookieOptions {
  return { ...sessionCookieOptions(appEnv), maxAge: 0 };
}
