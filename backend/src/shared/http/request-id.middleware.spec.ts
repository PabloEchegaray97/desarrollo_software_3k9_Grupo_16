import type { NextFunction, Response } from 'express';
import { jest } from '@jest/globals';
import { RequestIdMiddleware } from './request-id.middleware.js';
import type { RequestWithId } from './request-with-id.js';

function createResponse(): { response: Response; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    response: {
      setHeader(name: string, value: string): Response {
        headers[name] = value;
        return this;
      },
    } as unknown as Response,
  };
}

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('preserves a safe incoming request ID', () => {
    const request = { header: () => 'request-1234' } as unknown as RequestWithId;
    const { response, headers } = createResponse();
    const next = jest.fn() as NextFunction;

    middleware.use(request, response, next);

    expect(request.requestId).toBe('request-1234');
    expect(headers['x-request-id']).toBe('request-1234');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces unsafe input without reflecting it', () => {
    const request = { header: () => 'patient@email.example' } as unknown as RequestWithId;
    const { response, headers } = createResponse();

    middleware.use(request, response, jest.fn());

    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['x-request-id']).toBe(request.requestId);
    expect(headers['x-request-id']).not.toContain('patient');
  });
});
