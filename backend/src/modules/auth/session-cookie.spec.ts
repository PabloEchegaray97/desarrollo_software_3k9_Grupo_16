import { clearedSessionCookieOptions, readSessionCookie, sessionCookieOptions } from './session-cookie.js';

describe('session cookie helpers', () => {
  it('reads the session value among other cookies', () => {
    expect(readSessionCookie('theme=dark; session=abc.def.ghi; other=1')).toBe('abc.def.ghi');
  });

  it.each([undefined, '', 'theme=dark', 'session=', 'sessionx=abc', 'session=%E0%A4%A'])(
    'returns null for %p',
    (header) => {
      expect(readSessionCookie(header)).toBeNull();
    },
  );

  it('builds strict HttpOnly options and marks Secure only in production', () => {
    expect(sessionCookieOptions('development')).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: 28_800_000,
    });
    expect(sessionCookieOptions('production').secure).toBe(true);
  });

  it('expires the cookie immediately when clearing', () => {
    expect(clearedSessionCookieOptions('test')).toMatchObject({ maxAge: 0, httpOnly: true, path: '/' });
  });
});
