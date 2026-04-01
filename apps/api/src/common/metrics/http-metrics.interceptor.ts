import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { incHttpRequest, observeHttpDuration } from './prometheus';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<import('express').Request>();
    const res = ctx.getResponse<import('express').Response>();
    const start = process.hrtime.bigint();
    return next.handle().pipe(
      finalize(() => {
        const seconds = Number(process.hrtime.bigint() - start) / 1e9;
        const route =
          (req as { route?: { path?: string } }).route?.path ??
          req.path ??
          'unknown';
        const method = req.method ?? 'UNKNOWN';
        const status = String(res.statusCode ?? 500);
        incHttpRequest({ method, route, status });
        observeHttpDuration({ method, route, status }, seconds);
      }),
    );
  }
}
