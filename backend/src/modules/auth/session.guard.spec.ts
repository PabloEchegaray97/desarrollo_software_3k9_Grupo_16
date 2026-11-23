import { jest } from '@jest/globals';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import type { AuthenticatedRequest, SessionUser } from './session-user.js';

const SESSION_USER: SessionUser = { id: '7a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', email: 'odontologo.ficticio@example.test' };

function context(request: Partial<AuthenticatedRequest>, type = 'http'): ExecutionContext {
  return {
    getType: () => type,
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function setup(isPublic: boolean | undefined, user: SessionUser | null) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) } as unknown as Reflector;
  const findSessionUser = jest.fn<AuthService['findSessionUser']>().mockResolvedValue(user);
  const guard = new SessionGuard(reflector, { findSessionUser } as unknown as AuthService);
  return { guard, findSessionUser };
}

describe('SessionGuard', () => {
  it('lets public handlers through without reading the session', async () => {
    const { guard, findSessionUser } = setup(true, null);
    await expect(guard.canActivate(context({ method: 'POST', path: '/api/auth/login', headers: {} }))).resolves.toBe(true);
    expect(findSessionUser).not.toHaveBeenCalled();
  });

  it('keeps the healthcheck public for reads only', async () => {
    const { guard } = setup(undefined, null);
    await expect(guard.canActivate(context({ method: 'GET', path: '/api/health', headers: {} }))).resolves.toBe(true);
    await expect(guard.canActivate(context({ method: 'POST', path: '/api/health', headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects protected routes without a valid session', async () => {
    const { guard, findSessionUser } = setup(undefined, null);
    await expect(guard.canActivate(context({ method: 'GET', path: '/api/pacientes', headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findSessionUser).toHaveBeenCalledWith(null);
  });

  it('attaches the session user when the cookie is valid', async () => {
    const { guard, findSessionUser } = setup(undefined, SESSION_USER);
    const request: Partial<AuthenticatedRequest> = { method: 'GET', path: '/api/pacientes', headers: { cookie: 'session=abc' } };
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(findSessionUser).toHaveBeenCalledWith('abc');
    expect(request.sessionUser).toEqual(SESSION_USER);
  });

  it('ignores non-HTTP contexts', async () => {
    const { guard } = setup(undefined, null);
    await expect(guard.canActivate(context({}, 'rpc'))).resolves.toBe(true);
  });
});
