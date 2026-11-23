import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { RequestWithId } from './request-with-id.js';

const safeRequestId = /^[A-Za-z0-9._-]{8,100}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const received = request.header('x-request-id');
    request.requestId = received && safeRequestId.test(received) ? received : randomUUID();
    response.setHeader('x-request-id', request.requestId);
    next();
  }
}
