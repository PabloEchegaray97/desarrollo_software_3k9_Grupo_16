import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { AppEnvironment } from '../../config/env.validation.js';
import { sessionRequired } from './auth-errors.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { PublicRoute } from './public-route.decorator.js';
import { clearedSessionCookieOptions, sessionCookieOptions } from './session-cookie.js';
import { SESSION_COOKIE_NAME } from './session.contract.js';
import type { AuthenticatedRequest, SessionResponse } from './session-user.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppEnvironment, true>,
  ) {}

  @PublicRoute()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response): Promise<SessionResponse> {
    const { user, token } = await this.auth.login(input.email, input.contrasena);
    response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(this.appEnv()));
    return { usuario: user };
  }

  @Get('sesion')
  session(@Req() request: AuthenticatedRequest): SessionResponse {
    if (!request.sessionUser) throw sessionRequired();
    return { usuario: request.sessionUser };
  }

  @PublicRoute()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.cookie(SESSION_COOKIE_NAME, '', clearedSessionCookieOptions(this.appEnv()));
  }

  private appEnv(): AppEnvironment['APP_ENV'] {
    return this.config.get('APP_ENV', { infer: true });
  }
}
