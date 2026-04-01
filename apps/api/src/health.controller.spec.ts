import { ServiceUnavailableException } from '@nestjs/common';
import type { OperationalHealthService } from './common/health/operational-health.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns 200 payload for degraded readiness', async () => {
    const controller = new HealthController({
      snapshot: () =>
        Promise.resolve({
          status: 'degraded',
          summary: 'Redis unavailable but optional.',
          canServeTraffic: true,
          dependencies: {
            db: {
              status: 'up',
              required: true,
              configured: true,
              latencyMs: 3,
              detail: 'Prisma connectivity check succeeded.',
            },
            redis: {
              status: 'down',
              required: false,
              configured: true,
              latencyMs: 55,
              detail: 'Redis ping failed: ECONNREFUSED',
            },
          },
          topology: {
            idempotencyMode: 'redis_optional',
            websocketMode: 'redis_adapter',
          },
          checkedAt: '2026-03-28T10:00:00.000Z',
        }),
    } as OperationalHealthService);

    await expect(controller.ready()).resolves.toMatchObject({
      status: 'degraded',
      check: 'readiness',
      canServeTraffic: true,
      dependencies: {
        redis: { status: 'down' },
      },
    });
  });

  it('throws 503 payload for not_ready readiness', async () => {
    const controller = new HealthController({
      snapshot: () =>
        Promise.resolve({
          status: 'not_ready',
          summary: 'Redis is required and unavailable.',
          canServeTraffic: false,
          dependencies: {
            db: {
              status: 'up',
              required: true,
              configured: true,
              latencyMs: 3,
              detail: 'Prisma connectivity check succeeded.',
            },
            redis: {
              status: 'down',
              required: true,
              configured: true,
              latencyMs: 55,
              detail: 'Redis ping failed: timeout',
            },
          },
          topology: {
            idempotencyMode: 'redis_required',
            websocketMode: 'redis_adapter',
          },
          checkedAt: '2026-03-28T10:00:00.000Z',
        }),
    } as OperationalHealthService);

    await expect(controller.ready()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
