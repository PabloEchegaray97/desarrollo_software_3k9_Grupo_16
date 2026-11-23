import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody, ApiErrorDetails } from './api-error.js';
import type { RequestWithId } from './request-with-id.js';

type NestErrorResponse = { message?: string | string[]; error?: string };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const requestId = request.requestId ?? 'request-id-unavailable';
    const body = this.toBody(exception, status, requestId);

    this.logger.error({ requestId, method: request.method, path: request.originalUrl, status });
    response.status(status).json(body);
  }

  private toBody(exception: unknown, status: number, requestId: string): ApiErrorBody {
    if (!(exception instanceof HttpException)) {
      return { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error', requestId } };
    }

    const response = exception.getResponse();
    const normalized: NestErrorResponse =
      typeof response === 'string' ? { message: response } : (response as NestErrorResponse);
    const details: ApiErrorDetails | undefined = Array.isArray(normalized.message)
      ? normalized.message
      : undefined;
    const safeMessage =
      typeof normalized.message === 'string' ? normalized.message : exception.message;

    return {
      error: {
        code: status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : `HTTP_${status}`,
        message: details ? 'Request validation failed' : safeMessage,
        requestId,
        ...(details ? { details } : {}),
      },
    };
  }
}
