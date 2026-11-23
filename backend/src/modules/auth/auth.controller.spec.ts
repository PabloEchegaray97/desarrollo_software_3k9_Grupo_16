import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { AppEnvironment } from '../../config/env.validation.js';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { AuthenticatedRequest } from './session-user.js';

const USER = { id: '7a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', email: 'odontologo.ficticio@example.test' };

function setup(appEnv: AppEnvironment['APP_ENV']) {
  const auth = { login: jest.fn<AuthService['login']>().mockResolvedValue({ user: USER, token: 'signed.token.value' }) };
  const config = { get: () => appEnv } as unknown as ConfigService<AppEnvironment, true>;
  const cookie = jest.fn();
  const response = { cookie } as unknown as Response;
  return { controller: new AuthController(auth as unknown as AuthService, config), auth, cookie, response };
}

const loginInput = { email: USER.email, contrasena: 'contrasena-ficticia-123' } as LoginDto;

describe('AuthController', () => {
  it('sets the session cookie and returns only the user', async () => {
    const { controller, cookie, response } = setup('development');
    await expect(controller.login(loginInput, response)).resolves.toEqual({ usuario: USER });
    expect(cookie).toHaveBeenCalledWith('session', 'signed.token.value', {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: 28_800_000,
    });
  });

  it('marks the cookie Secure in production', async () => {
    const { controller, cookie, response } = setup('production');
    await controller.login(loginInput, response);
    expect(cookie.mock.calls[0][2]).toMatchObject({ secure: true });
  });

  it('clears the cookie on logout', () => {
    const { controller, cookie, response } = setup('development');
    controller.logout(response);
    expect(cookie).toHaveBeenCalledWith('session', '', expect.objectContaining({ maxAge: 0, httpOnly: true }));
  });

  it('returns the session user attached by the guard', () => {
    const { controller } = setup('development');
    expect(controller.session({ sessionUser: USER } as AuthenticatedRequest)).toEqual({ usuario: USER });
    expect(() => controller.session({} as AuthenticatedRequest)).toThrow(UnauthorizedException);
  });
});
