import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { LeaderLockService } from '../../common/leader-lock/leader-lock.service';
import { incBusinessEvent } from '../../common/metrics/prometheus';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuditRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditRetentionService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderLock: LeaderLockService,
  ) {}

  onModuleInit() {
    const days = Number(process.env.AUDIT_LOG_RETENTION_DAYS);
    if (!Number.isFinite(days) || days <= 0) {
      this.logger.log(
        'AUDIT_LOG_RETENTION_DAYS not set or invalid; audit log pruning disabled',
      );
      return;
    }
    this.timer = setInterval(() => {
      void this.pruneOlderThan(days);
    }, DAY_MS);
    this.logger.log(
      `Audit log retention enabled: deleting rows older than ${days} days (interval 24h)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async pruneOlderThan(retentionDays: number) {
    await this.leaderLock.tryRunExclusive(
      'audit_retention_prune',
      3600,
      async () => {
        const cutoff = new Date();
        cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
        try {
          const res = await this.prisma.auditLog.deleteMany({
            where: { createdAt: { lt: cutoff } },
          });
          if (res.count > 0) {
            incBusinessEvent('audit_retention_prune');
            this.logger.log(
              JSON.stringify({
                msg: 'audit_retention_prune',
                rowsDeleted: res.count,
                retentionDays,
              }),
            );
          }
        } catch (e) {
          this.logger.warn(
            `Audit log prune failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      },
    );
  }
}
