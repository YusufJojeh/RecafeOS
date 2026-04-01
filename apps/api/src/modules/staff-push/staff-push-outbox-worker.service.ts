import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StaffPushOutboxStatus } from '@prisma/client';
import type { StaffPushDeliveryEnvelope } from '@restocafe/types';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffPushService } from './staff-push.service';
import { StaffPushProviderPort } from './staff-push-provider.port';

const DRAIN_INTERVAL_MS = 20_000;
const MAX_PER_TICK = 50;
const MAX_ATTEMPTS = 5;
const BACKOFF_CAP_MS = 300_000;
const DEFAULT_STALE_PROCESSING_SEC = 300;
const RECLAIM_COOLDOWN_MS = 1_000;

function backoffMs(attempts: number): number {
  const n = 1000 * Math.pow(2, Math.min(attempts, 8));
  return Math.min(BACKOFF_CAP_MS, n);
}

@Injectable()
export class StaffPushOutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StaffPushOutboxWorkerService.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: StaffPushProviderPort,
    private readonly staffPush: StaffPushService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.drainBatch(MAX_PER_TICK).catch((err: unknown) => {
        this.logger.error(
          JSON.stringify({
            msg: 'staff_push_outbox_tick_failed',
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      });
    }, DRAIN_INTERVAL_MS);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private staleProcessingMs(): number {
    const sec = Number(
      this.config.get<string | number>('STAFF_PUSH_STALE_PROCESSING_SEC') ??
        DEFAULT_STALE_PROCESSING_SEC,
    );
    const clamped =
      Number.isFinite(sec) && sec >= 60 && sec <= 7200
        ? sec
        : DEFAULT_STALE_PROCESSING_SEC;
    return clamped * 1000;
  }

  /**
   * Rows stuck in PROCESSING (API crash mid-job) are returned to PENDING for retry.
   * Exposed for unit tests; runs automatically at the start of each `drainBatch`.
   */
  async reclaimStaleProcessing(): Promise<number> {
    const cutoff = new Date(Date.now() - this.staleProcessingMs());
    const nextAttemptAt = new Date(Date.now() + RECLAIM_COOLDOWN_MS);
    const stale = await this.prisma.staffPushOutbox.findMany({
      where: {
        status: StaffPushOutboxStatus.PROCESSING,
        processingStartedAt: { lt: cutoff },
      },
      select: { id: true, attempts: true },
    });
    let n = 0;
    for (const row of stale) {
      const attempts = row.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await this.prisma.staffPushOutbox.update({
          where: { id: row.id },
          data: {
            status: StaffPushOutboxStatus.DEAD,
            attempts,
            lastError: 'stale_processing_reclaim_exhausted',
            processingStartedAt: null,
          },
        });
      } else {
        await this.prisma.staffPushOutbox.update({
          where: { id: row.id },
          data: {
            status: StaffPushOutboxStatus.PENDING,
            attempts,
            lastError: 'stale_processing_reclaim',
            nextAttemptAt,
            processingStartedAt: null,
          },
        });
      }
      n += 1;
    }
    if (n > 0) {
      this.logger.warn(
        JSON.stringify({
          msg: 'staff_push_outbox_stale_processing_reclaimed',
          rows: n,
          staleAfterMs: this.staleProcessingMs(),
        }),
      );
    }
    return n;
  }

  /** Process up to `max` pending rows (immediate drain from dispatcher uses this too). */
  async drainBatch(max: number): Promise<number> {
    await this.reclaimStaleProcessing();
    let done = 0;
    for (let i = 0; i < max; i++) {
      const progressed = await this.processOne();
      if (!progressed) {
        break;
      }
      done += 1;
    }
    return done;
  }

  private async processOne(): Promise<boolean> {
    const row = await this.prisma.staffPushOutbox.findFirst({
      where: {
        status: StaffPushOutboxStatus.PENDING,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!row) {
      return false;
    }

    const locked = await this.prisma.staffPushOutbox.updateMany({
      where: { id: row.id, status: StaffPushOutboxStatus.PENDING },
      data: {
        status: StaffPushOutboxStatus.PROCESSING,
        processingStartedAt: new Date(),
      },
    });
    if (locked.count === 0) {
      return false;
    }

    const envelope: StaffPushDeliveryEnvelope = {
      tenantId: row.tenantId,
      branchId: row.branchId,
      event: row.event as StaffPushDeliveryEnvelope['event'],
      payload: row.payload as StaffPushDeliveryEnvelope['payload'],
    };

    try {
      const result = await this.provider.deliver(envelope);
      await this.applyResult(row.id, row.tenantId, row.attempts, result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.markDeadOrRetry(row.id, row.attempts + 1, message, true);
    }
    return true;
  }

  private async applyResult(
    id: string,
    tenantId: string,
    priorAttempts: number,
    result: Awaited<ReturnType<StaffPushProviderPort['deliver']>>,
  ): Promise<void> {
    const attempts = priorAttempts + 1;
    if (result.outcome === 'invalid_tokens' && result.tokens.length > 0) {
      const pruned = await this.staffPush.deleteDevicesWithTokens(
        tenantId,
        result.tokens,
      );
      this.logger.log(
        JSON.stringify({
          msg: 'staff_push_invalid_tokens_pruned',
          tenantId,
          pruned: pruned.count,
        }),
      );
    }

    if (result.outcome === 'submitted') {
      await this.prisma.staffPushOutbox.update({
        where: { id },
        data: {
          status: StaffPushOutboxStatus.COMPLETED,
          attempts,
          lastError: null,
          processingStartedAt: null,
          completedAt: new Date(),
        },
      });
      return;
    }

    if (result.outcome === 'invalid_tokens') {
      await this.prisma.staffPushOutbox.update({
        where: { id },
        data: {
          status: StaffPushOutboxStatus.COMPLETED,
          attempts,
          lastError: result.message ?? 'invalid_tokens',
          processingStartedAt: null,
          completedAt: new Date(),
        },
      });
      return;
    }

    await this.markDeadOrRetry(id, attempts, result.message, result.retryable);
  }

  private async markDeadOrRetry(
    id: string,
    attempts: number,
    message: string,
    retryable: boolean,
  ): Promise<void> {
    if (!retryable || attempts >= MAX_ATTEMPTS) {
      await this.prisma.staffPushOutbox.update({
        where: { id },
        data: {
          status: StaffPushOutboxStatus.DEAD,
          attempts,
          lastError: message,
          processingStartedAt: null,
        },
      });
      return;
    }

    const next = new Date(Date.now() + backoffMs(attempts));
    await this.prisma.staffPushOutbox.update({
      where: { id },
      data: {
        status: StaffPushOutboxStatus.PENDING,
        attempts,
        lastError: message,
        nextAttemptAt: next,
        processingStartedAt: null,
      },
    });
  }
}
