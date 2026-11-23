import { createHmac } from 'node:crypto';
import { SessionTokenService, type Clock } from './session-token.service.js';

const SECRET = 'fictional-secret-with-at-least-32-characters';
const USER_ID = '7a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });

function forge(header: object, payload: object, secret = SECRET): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode(header)}.${encode(payload)}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

describe('SessionTokenService', () => {
  const issuedAt = '2026-11-24T12:00:00.000Z';
  const service = new SessionTokenService(SECRET, fixedClock(issuedAt));

  it('signs an eight-hour HS256 token that verifies', () => {
    const claims = service.verify(service.sign(USER_ID));
    expect(claims).toEqual({ sub: USER_ID, iat: 1_795_521_600, exp: 1_795_521_600 + 28_800 });
  });

  it('rejects an expired token', () => {
    const token = service.sign(USER_ID);
    const later = new SessionTokenService(SECRET, fixedClock('2026-11-24T20:00:00.000Z'));
    expect(later.verify(token)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const other = new SessionTokenService('another-fictional-secret-with-32-characters', fixedClock(issuedAt));
    expect(service.verify(other.sign(USER_ID))).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const [header, , signature] = service.sign(USER_ID).split('.');
    const payload = Buffer.from(JSON.stringify({ sub: 'otro', iat: 1, exp: 9_999_999_999 })).toString('base64url');
    expect(service.verify(`${header}.${payload}.${signature}`)).toBeNull();
  });

  it.each([{ alg: 'none', typ: 'JWT' }, { alg: 'HS512', typ: 'JWT' }, { alg: 'HS256' }])(
    'rejects header %p even with a valid HMAC',
    (header) => {
      expect(service.verify(forge(header, { sub: USER_ID, iat: 1, exp: 9_999_999_999 }))).toBeNull();
    },
  );

  it.each(['', 'a.b', 'a.b.c.d', 'no-es-un-token', '..'])('rejects malformed token %p', (token) => {
    expect(service.verify(token)).toBeNull();
  });

  it('rejects claims with invalid types', () => {
    const header = { alg: 'HS256', typ: 'JWT' };
    expect(service.verify(forge(header, { sub: '', iat: 1, exp: 9_999_999_999 }))).toBeNull();
    expect(service.verify(forge(header, { sub: USER_ID, iat: 1 }))).toBeNull();
    expect(service.verify(forge(header, { sub: USER_ID, iat: 1, exp: '9999999999' }))).toBeNull();
  });
});
