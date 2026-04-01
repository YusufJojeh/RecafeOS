import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { addDays } from 'date-fns';
import { CommerceService } from '../../commerce/commerce.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ensureGlobalPermissions,
  ensureRoleTemplatesForTenant,
} from '../../provisioning/provisioning.helpers';
import type { CreateStaffInviteDto } from './dto/create-staff-invite.dto';

const INVITE_TTL_DAYS = 14;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commerce: CommerceService,
    private readonly audit: AuditService,
  ) {}

  async listPending(tenantId: string) {
    return this.prisma.staffInvite.findMany({
      where: { tenantId, usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        roleName: true,
        expiresAt: true,
        defaultBranchId: true,
        createdAt: true,
      },
    });
  }

  async createInvite(
    tenantId: string,
    actorId: string,
    dto: CreateStaffInviteDto,
  ) {
    const email = dto.email.toLowerCase().trim();
    const roleName = dto.role ?? 'cashier';

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant');
    }
    this.commerce.assertStaffTenantAccess(tenant);

    if (dto.defaultBranchId?.trim()) {
      const b = await this.prisma.branch.findFirst({
        where: { id: dto.defaultBranchId.trim(), tenantId },
        select: { id: true },
      });
      if (!b) {
        throw new BadRequestException(
          'defaultBranchId does not belong to tenant',
        );
      }
    }

    const existingMember = await this.prisma.tenantMember.findFirst({
      where: { tenantId, user: { email } },
    });
    if (existingMember) {
      throw new BadRequestException('USER_ALREADY_MEMBER');
    }

    const tenantForLimits = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });
    const limits = this.commerce.getEffectiveLimits(tenantForLimits);
    const memberCount = await this.prisma.tenantMember.count({
      where: { tenantId },
    });
    if (memberCount >= limits.maxUsers) {
      throw new BadRequestException('SEAT_LIMIT_REACHED');
    }

    const plainToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(plainToken);
    const expiresAt = addDays(new Date(), INVITE_TTL_DAYS);

    const invite = await this.prisma.$transaction(async (tx) => {
      await ensureGlobalPermissions(tx);
      await ensureRoleTemplatesForTenant(tx, tenantId);
      const role = await tx.role.findFirst({
        where: { tenantId, name: roleName },
      });
      if (!role) {
        throw new BadRequestException('ROLE_NOT_FOUND');
      }
      return tx.staffInvite.create({
        data: {
          tenantId,
          email,
          roleName,
          tokenHash,
          expiresAt,
          defaultBranchId: dto.defaultBranchId?.trim() || null,
          createdByUserId: actorId,
        },
      });
    });

    await this.audit.log({
      tenantId,
      branchId: dto.defaultBranchId?.trim() || undefined,
      actorId,
      action: 'tenant.invite_created',
      entity: 'staff_invite',
      entityId: invite.id,
      metadata: { email, role: roleName },
    });

    return {
      id: invite.id,
      email: invite.email,
      role: invite.roleName,
      expiresAt: invite.expiresAt.toISOString(),
      /** Single-use accept token (show once). */
      acceptToken: plainToken,
    };
  }
}
