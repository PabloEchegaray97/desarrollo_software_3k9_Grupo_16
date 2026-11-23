import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { sessionRequired } from './auth-errors.js';
import { AuthService } from './auth.service.js';
import { PUBLIC_ROUTE } from './public-route.decorator.js';
import { readSessionCookie } from './session-cookie.js';
import type { AuthenticatedRequest } from './session-user.js';

/** Rutas de otros owners que deben seguir públicas sin editar sus controladores. */
const PUBLIC_READ_PATHS: ReadonlySet<string> = new Set(['/api/health']);
const READ_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/** Guard global: toda la API exige sesión salvo las rutas públicas declaradas. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (READ_METHODS.has(request.method) && PUBLIC_READ_PATHS.has(request.path)) return true;

    const user = await this.auth.findSessionUser(readSessionCookie(request.headers.cookie));
    if (!user) throw sessionRequired();
    request.sessionUser = user;
    return true;
  }
}
