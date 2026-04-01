import { Injectable, Logger } from '@nestjs/common';
import { incBusinessEvent } from '../../common/metrics/prometheus';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogParams {
  tenantId: string;
  branchId?: string;
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit log entry and wait for confirmation.
   * Use on cold paths (admin, support, settings) where blocking is acceptable.
   */
  async log(params: AuditLogParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        branchId: params.branchId,
        actorId: params.actorId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: params.metadata as object,
      },
    });
    incBusinessEvent('audit_log_write');
  }

  /**
   * Fire-and-forget audit log write for hot paths (order state transitions).
   * Failures are logged and counted but never block the HTTP response.
   * The audit entry is NOT inside a transaction — if it fails, the state
   * transition has already committed and is not rolled back.
   */
  logAsync(params: AuditLogParams): void {
    this.log(params).catch((err: unknown) => {
      incBusinessEvent('audit_log_write_failed');
      this.logger.warn(
        `Audit log write failed: action=${params.action} entity=${params.entity} ` +
          `entityId=${params.entityId ?? '?'} error=${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }
}
