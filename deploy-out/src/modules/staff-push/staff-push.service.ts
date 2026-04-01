import { Injectable } from '@nestjs/common';
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
}
