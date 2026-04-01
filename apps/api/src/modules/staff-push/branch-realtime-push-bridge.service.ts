import { Injectable, Logger } from '@nestjs/common';
import type { BranchRealtimePayloads } from '@restocafe/types';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffPushDispatchPort } from './staff-push-dispatch.port';

/**
 * Called from `OpsGateway.emitBranchEvent` after the Socket.IO fan-out.
 * Resolves `tenantId` for push targeting (tokens are stored per user+tenant).
 */
@Injectable()
export class BranchRealtimePushBridgeService {
  private readonly logger = new Logger(BranchRealtimePushBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: StaffPushDispatchPort,
  ) {}

  async relayFromRealtime<K extends keyof BranchRealtimePayloads>(
    branchId: string,
    event: K,
    payload: BranchRealtimePayloads[K],
  ): Promise<void> {
    const row = await this.prisma.branch.findFirst({
      where: { id: branchId },
      select: { tenantId: true },
    });
    if (!row) {
      this.logger.warn(
        JSON.stringify({ msg: 'push_bridge_unknown_branch', branchId }),
      );
      return;
    }
    await this.dispatch.enqueueFromBranchEvent({
      tenantId: row.tenantId,
      branchId,
      event,
      payload,
    });
  }
}
