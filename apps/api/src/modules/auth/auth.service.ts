import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type {
  JwtAccessPayload,
  JwtRefreshPayload,
} from '../../common/types/jwt-payload';
import { addDuration, parseDurationSpec } from '../../common/config/duration';
import { CommerceService } from '../../commerce/commerce.service';
import { AuditService } from '../audit/audit.service';
import {
  ensureGlobalPermissions,
  ensureRoleTemplatesForTenant,
  hashPassword,
} from '../../provisioning/provisioning.helpers';
import { PrismaService } from '../../prisma/prisma.service';
import { STAFF_BRANCH_ACCESS_SCOPE } from '@restocafe/types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly commerce: CommerceService,
    private readonly audit: AuditService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      return null;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return null;
    }
    return user;
  }

  /**
   * Single round-trip for membership + permissions. `null` if the user is not in the tenant.
   */
  async memberPermissionCodes(
    userId: string,
    tenantId: string,
  ): Promise<string[] | null> {
    const member = await this.prisma.tenantMember.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });
    if (!member) {
      return null;
    }
    return member.role.permissions.map((rp) => rp.permission.code);
  }

  async getPermissionsForTenant(
    userId: string,
    tenantId: string,
  ): Promise<string[]> {
    return (await this.memberPermissionCodes(userId, tenantId)) ?? [];
  }

  /**
   * Server-known branch UI context for staff: default branch preference and how branch
   * access is scoped. Today there is no per-user branch allow-list; `branchAccessScope`
   * is always `ALL_TENANT_BRANCHES` until product adds assignments.
   */
  async getStaffSessionBranchContext(
    userId: string,
    tenantId: string,
  ): Promise<{
    branchAccessScope: (typeof STAFF_BRANCH_ACCESS_SCOPE)[keyof typeof STAFF_BRANCH_ACCESS_SCOPE];
    defaultBranchId: string | null;
  }> {
    const member = await this.prisma.tenantMember.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { defaultBranchId: true },
    });
    if (!member) {
      return {
        branchAccessScope: STAFF_BRANCH_ACCESS_SCOPE.ALL_TENANT_BRANCHES,
        defaultBranchId: null,
      };
    }
    let defaultBranchId: string | null = member.defaultBranchId;
    if (defaultBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: defaultBranchId, tenantId },
        select: { id: true },
      });
      if (!branch) {
        defaultBranchId = null;
      }
    }
    return {
      branchAccessScope: STAFF_BRANCH_ACCESS_SCOPE.ALL_TENANT_BRANCHES,
      defaultBranchId,
    };
  }

  async login(email: string, password: string, tenantSlug?: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const memberships = await this.prisma.tenantMember.findMany({
      where: { userId: user.id },
      include: { tenant: true },
    });
    if (memberships.length === 0) {
      throw new UnauthorizedException('No tenant access');
    }
    let tenantId = memberships[0].tenantId;
    if (tenantSlug) {
      const m = memberships.find((x) => x.tenant.slug === tenantSlug);
      if (!m) {
        throw new UnauthorizedException('Tenant not found');
      }
      tenantId = m.tenantId;
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }
    this.commerce.assertStaffTenantAccess(tenant);
    const permissions = await this.getPermissionsForTenant(user.id, tenantId);
    const tokens = await this.issueTokens(user.id, tenantId, permissions);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      tenantId,
      tenants: memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
      })),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException();
    }
    if (!payload.tenantId?.trim()) {
      throw new UnauthorizedException();
    }
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException();
    }
    const member = await this.prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: { userId: payload.sub, tenantId: payload.tenantId },
      },
    });
    if (!member) {
      throw new UnauthorizedException();
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: payload.tenantId },
    });
    if (!tenant) {
      throw new UnauthorizedException();
    }
    this.commerce.assertStaffTenantAccess(tenant);
    const permissions = await this.getPermissionsForTenant(
      payload.sub,
      payload.tenantId,
    );
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    const issued = await this.issueTokens(
      payload.sub,
      payload.tenantId,
      permissions,
    );
    return { ...issued, tenantId: payload.tenantId };
  }

  /**
   * Accept a staff invite token (manager / cashier / kitchen). Returns tokens like login.
   */
  async acceptInvite(token: string, password: string, displayName?: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token, 'utf8')
      .digest('hex');
    const invite = await this.prisma.staffInvite.findUnique({
      where: { tokenHash },
    });
    if (!invite || invite.usedAt) {
      throw new UnauthorizedException('INVALID_OR_USED_INVITE');
    }
    if (invite.expiresAt < new Date()) {
      throw new UnauthorizedException('INVITE_EXPIRED');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: invite.tenantId },
    });
    if (!tenant) {
      throw new UnauthorizedException();
    }
    this.commerce.assertStaffTenantAccess(tenant);

    const email = invite.email.toLowerCase();
    const result = await this.prisma.$transaction(async (tx) => {
      await ensureGlobalPermissions(tx);
      await ensureRoleTemplatesForTenant(tx, invite.tenantId);

      const existingMember = await tx.tenantMember.findFirst({
        where: { tenantId: invite.tenantId, user: { email } },
      });
      if (existingMember) {
        throw new UnauthorizedException('USER_ALREADY_MEMBER');
      }

      const tenantForLimits = await tx.tenant.findUniqueOrThrow({
        where: { id: invite.tenantId },
      });
      const limits = this.commerce.getEffectiveLimits(tenantForLimits);
      const memberCount = await tx.tenantMember.count({
        where: { tenantId: invite.tenantId },
      });
      if (memberCount >= limits.maxUsers) {
        throw new UnauthorizedException('SEAT_LIMIT_REACHED');
      }

      const role = await tx.role.findFirst({
        where: { tenantId: invite.tenantId, name: invite.roleName },
      });
      if (!role) {
        throw new UnauthorizedException('ROLE_NOT_FOUND');
      }

      const existingUser = await tx.user.findUnique({ where: { email } });
      let userId: string;
      if (existingUser) {
        const pwdOk = await bcrypt.compare(password, existingUser.passwordHash);
        if (!pwdOk) {
          throw new UnauthorizedException('INVALID_PASSWORD');
        }
        userId = existingUser.id;
      } else {
        const passwordHash = await hashPassword(password);
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName: displayName?.trim() || email.split('@')[0] || 'User',
          },
        });
        userId = created.id;
      }

      const member = await tx.tenantMember.create({
        data: {
          userId,
          tenantId: invite.tenantId,
          roleId: role.id,
          defaultBranchId: invite.defaultBranchId,
        },
      });

      await tx.staffInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      return { userId, tenantId: invite.tenantId, memberId: member.id };
    });

    const permissions = await this.getPermissionsForTenant(
      result.userId,
      result.tenantId,
    );
    const tokens = await this.issueTokens(
      result.userId,
      result.tenantId,
      permissions,
    );
    await this.audit.log({
      tenantId: result.tenantId,
      branchId: invite.defaultBranchId ?? undefined,
      actorId: result.userId,
      action: 'tenant.invite_accepted',
      entity: 'staff_invite',
      entityId: invite.id,
      metadata: { email: invite.email, role: invite.roleName },
    });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
    });
    const memberships = await this.prisma.tenantMember.findMany({
      where: { userId: result.userId },
      include: { tenant: true },
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      tenantId: result.tenantId,
      tenants: memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
      })),
      ...tokens,
    };
  }

  async logout(refreshToken: string) {
    try {
      await this.prisma.refreshToken.deleteMany({
        where: { tokenHash: this.hashToken(refreshToken) },
      });
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(
    userId: string,
    tenantId: string,
    permissions: string[],
  ) {
    const accessTtl = parseDurationSpec(
      this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      'JWT_ACCESS_TTL',
    );
    const refreshTtl = parseDurationSpec(
      this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
      'JWT_REFRESH_TTL',
    );

    const accessPayload: JwtAccessPayload = {
      sub: userId,
      tenantId,
      permissions,
      type: 'access',
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl.jwtExpiresIn,
    });

    const refreshId = crypto.randomUUID();
    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      tokenId: refreshId,
      tenantId,
      type: 'refresh',
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTtl.jwtExpiresIn,
    });

    const refreshExpires = addDuration(
      new Date(),
      this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
      'JWT_REFRESH_TTL',
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpires,
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtl.seconds };
  }
}
