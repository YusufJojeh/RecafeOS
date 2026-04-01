import { Injectable } from '@nestjs/common';
import type { StaffPushDeviceTarget } from '@restocafe/types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StaffPushService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, tenantId: string, platform: string, token: string) {
    return this.prisma.staffPushDevice.upsert({
      where: {
        userId_tenantId_platform_token: {
          userId,
          tenantId,
          platform,
          token,
        },
      },
      create: { userId, tenantId, platform, token },
      update: { updatedAt: new Date() },
    });
  }

  listForUser(userId: string, tenantId: string) {
    return this.prisma.staffPushDevice.findMany({
      where: { userId, tenantId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        platform: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * All push targets for a tenant (v1 fan-out). Future: branch- or role-filtered subsets.
   * Intended for `StaffPushProviderPort` implementations only — never expose raw tokens on list APIs.
   */
  async listTargetsForTenantDelivery(tenantId: string): Promise<StaffPushDeviceTarget[]> {
    return this.prisma.staffPushDevice.findMany({
      where: { tenantId },
      select: { userId: true, platform: true, token: true },
    });
  }

  /** Idempotent cleanup when a device unsubscribes or logs out. */
  unregister(userId: string, tenantId: string, platform: string, token: string) {
    return this.prisma.staffPushDevice.deleteMany({
      where: {
        userId,
        tenantId,
        platform,
        token: token.trim(),
      },
    });
  }

  /** Called when a provider reports unregistered/invalid tokens (FCM/APNs). */
  deleteDevicesWithTokens(tenantId: string, tokens: string[]) {
    const uniq = [...new Set(tokens.filter(Boolean))];
    if (uniq.length === 0) {
      return Promise.resolve({ count: 0 });
    }
    return this.prisma.staffPushDevice.deleteMany({
      where: { tenantId, token: { in: uniq } },
    });
  }
}
