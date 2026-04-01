import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { httpLogFields } from './log-fields';

function slowThresholdMs(): number {
  const n = Number(process.env.SLOW_REQUEST_MS);
  return Number.isFinite(n) && n > 0 ? n : 2000;
}

@Injectable()
export class SlowRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SlowRequestInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const start = process.hrtime.bigint();
    const threshold = slowThresholdMs();
    return next.handle().pipe(
      finalize(() => {
        const seconds = Number(process.hrtime.bigint() - start) / 1e9;
        const ms = Math.round(seconds * 1000);
        if (ms < threshold) {
          return;
        }
        this.logger.warn({
          msg: 'slow_request',
          durationMs: ms,
          thresholdMs: threshold,
          ...httpLogFields(req),
        });
      }),
    );
  }
}
