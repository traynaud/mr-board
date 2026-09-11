import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Normalised error payload returned by every failing endpoint. */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  code?: string;
  timestamp: string;
  path: string;
}

/**
 * Converts any thrown error into the normalised {@link ErrorResponse}.
 * Unexpected errors are logged with their stack and returned as 500 without
 * leaking internal details.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * @param exception the caught error.
   * @param host execution context giving access to request/response.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const body = HttpExceptionFilter.toBody(exception, request.url);
    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    response.status(body.statusCode).json(body);
  }

  /**
   * Maps an error to the normalised body.
   * @param exception the caught error.
   * @param path request path echoed in the response.
   */
  static toBody(exception: unknown, path: string): ErrorResponse {
    const timestamp = new Date().toISOString();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const details: {
        message?: string | string[];
        code?: string;
        error?: string;
      } = typeof res === 'string' ? { message: res } : res;
      return {
        statusCode: status,
        error: details.error ?? reasonPhrase(status),
        message: details.message ?? exception.message,
        ...(details.code ? { code: details.code } : {}),
        timestamp,
        path,
      };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
      timestamp,
      path,
    };
  }
}

/**
 * Standard HTTP reason phrase for a status code (`502` → `Bad Gateway`),
 * matching the `error` label produced by Nest's built-in exceptions.
 * @param status HTTP status code.
 */
export function reasonPhrase(status: number): string {
  const name = HttpStatus[status];
  if (!name) {
    return `Error ${status}`;
  }
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
