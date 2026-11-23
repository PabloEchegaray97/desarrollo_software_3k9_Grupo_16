import { PASSWORD_DERIVATION } from './password-hasher.contract.js';
import { SESSION_COOKIE_CONTRACT, SESSION_TTL_SECONDS } from './session.contract.js';

describe('authentication contracts', () => {
  it('keeps the JWT session in a strict HttpOnly cookie for eight hours', () => {
    expect(SESSION_COOKIE_CONTRACT).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      secureInProduction: true,
      ttlSeconds: 28_800,
    });
    expect(SESSION_TTL_SECONDS).toBe(8 * 60 * 60);
  });

  it('selects scrypt without storing a password implementation in C-01', () => {
    expect(PASSWORD_DERIVATION).toEqual({ algorithm: 'scrypt', saltBytes: 16, keyLength: 64 });
  });
});
