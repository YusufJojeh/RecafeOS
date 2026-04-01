import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { incHttpException, incUnhandledError } from '../metrics/prometheus';
import { redactSensitiveRequestUrl } from './redact-sensitive-url';

function safeJsonLine(fields: Record<string, unknown>): string {
  return JSON.stringify({ svc: 'restocafe-api', ...fields });
}

/**
 * Avoids leaking stack traces and internal error details in production responses.
 * Logs structured lines for aggregation (requestId, tenant, branch, exception class).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    const rawUrl = req.originalUrl ?? req.url ?? '';
    const baseFields = {
      requestId: req.requestId,
      method: req.method,
      url: redactSensitiveRequestUrl(rawUrl),
      tenantId: req.user?.tenantId,
      branchId: req.branchId,
    };

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const name = exception.constructor.name;
      incHttpException(status, name);

      const level = status >= 500 ? 'error' : 'warn';
      this.logger[level](
        safeJsonLine({
          msg: 'http_exception',
          status,
          exception: name,
          ...baseFields,
          detail:
            typeof body === 'object' && body !== null && 'message' in body
              ? (body as { message?: unknown }).message
              : body,
        }),
      );

      res
        .status(status)
        .json(
          typeof body === 'object' && body !== null
            ? body
            : { statusCode: status, message: body },
        );
      return;
    }

    incUnhandledError();
    const err =
      exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(
      safeJsonLine({
        msg: 'unhandled_exception',
        ...baseFields,
        error: err.message,
        stack: isProd ? undefined : err.stack,
      }),
    );

    if (isProd) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      });
      return;
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: err.message,
      error: err.stack,
    });
  }
}
