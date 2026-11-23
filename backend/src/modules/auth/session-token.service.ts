import { createHmac, timingSafeEqual } from 'node:crypto';
import { SESSION_TTL_SECONDS } from './session.contract.js';

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export interface SessionClaims {
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
}

const HEADER = { alg: 'HS256', typ: 'JWT' } as const;

function encodeSegment(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeSegment(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JWT HS256 mínimo firmado con `AUTH_SECRET`; nunca acepta el algoritmo declarado por el token. */
export class SessionTokenService {
  constructor(
    private readonly secret: string,
    private readonly clock: Clock = systemClock,
  ) {}

  sign(userId: string): string {
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    const claims: SessionClaims = { sub: userId, iat: issuedAt, exp: issuedAt + SESSION_TTL_SECONDS };
    const unsigned = `${encodeSegment(HEADER)}.${encodeSegment(claims)}`;
    return `${unsigned}.${this.signature(unsigned)}`;
  }

  verify(token: string): SessionClaims | null {
    const segments = token.split('.');
    if (segments.length !== 3) return null;
    const [headerSegment, payloadSegment, signatureSegment] = segments;

    const header = decodeSegment(headerSegment);
    if (!isRecord(header) || header.alg !== HEADER.alg || header.typ !== HEADER.typ) return null;

    const expected = Buffer.from(this.signature(`${headerSegment}.${payloadSegment}`), 'base64url');
    const actual = Buffer.from(signatureSegment, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const payload = decodeSegment(payloadSegment);
    if (!isRecord(payload)) return null;
    const { sub, iat, exp } = payload;
    if (typeof sub !== 'string' || sub.length === 0) return null;
    if (!Number.isInteger(iat) || !Number.isInteger(exp)) return null;
    const nowSeconds = Math.floor(this.clock.now().getTime() / 1000);
    if ((exp as number) <= nowSeconds) return null;
    return { sub, iat: iat as number, exp: exp as number };
  }

  private signature(unsigned: string): string {
    return createHmac('sha256', this.secret).update(unsigned).digest('base64url');
  }
}
