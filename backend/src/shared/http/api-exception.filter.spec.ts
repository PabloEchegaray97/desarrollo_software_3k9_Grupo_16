import { BadRequestException, type ArgumentsHost, Logger } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter.js';
import type { ApiErrorBody } from './api-error.js';
import type { RequestWithId } from './request-with-id.js';

interface CapturedResponse {
  status?: number;
  body?: ApiErrorBody;
}

function createHost(captured: CapturedResponse): ArgumentsHost {
  const request = {
    requestId: 'request-1234',
    method: 'POST',
    originalUrl: '/api/patients',
  } as RequestWithId;
  const response = {
    status(status: number): Response {
      captured.status = status;
      return this as unknown as Response;
    },
    json(body: ApiErrorBody): Response {
      captured.body = body;
      return this as unknown as Response;
    },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;
}

describe('ApiExceptionFilter', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('normalizes validation errors', () => {
    const captured: CapturedResponse = {};
    const exception = new BadRequestException({ message: ['name must not be empty'] });

    new ApiExceptionFilter().catch(exception, createHost(captured));

    expect(captured.status).toBe(400);
    expect(captured.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        requestId: 'request-1234',
        details: ['name must not be empty'],
      },
    });
  });

  it('does not expose internal messages, stacks or personal payloads', () => {
    const captured: CapturedResponse = {};
    const exception = new Error('database password secret and patient@email.example');

    new ApiExceptionFilter().catch(exception, createHost(captured));

    expect(captured.status).toBe(500);
    expect(JSON.stringify(captured.body)).toBe(JSON.stringify({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error', requestId: 'request-1234' },
    }));
  });
});
