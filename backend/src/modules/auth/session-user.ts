import type { Request } from 'express';

export interface SessionUser {
  readonly id: string;
  readonly email: string;
}

export interface SessionResponse {
  readonly usuario: SessionUser;
}

export interface AuthenticatedRequest extends Request {
  sessionUser?: SessionUser;
}
