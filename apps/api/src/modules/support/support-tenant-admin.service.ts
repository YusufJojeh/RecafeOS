import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { BillingStatus, type Tenant } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { BranchMenuCacheInvalidationService } from '../../common/menu-cache/branch-menu-cache-invalidation.service';
import { LeaderLockService } from '../../common/leader-lock/leader-lock.service';
import { CommerceService } from '../../commerce/commerce.service';
import {
  ensureGlobalPermissions,
  ensureRoleTemplatesForTenant,
  hashPassword,
} from '../../provisioning/provisioning.helpers';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CloneMenuDto } from './dto/clone-menu.dto';
import type { CreateSupportTenantMemberDto } from './dto/create-support-tenant-member.dto';
import type { PatchSupportCommerceDto } from './dto/patch-support-commerce.dto';
import type { PatchSupportMetadataDto } from './dto/patch-support-metadata.dto';
import type { SuspendTenantDto } from './dto/suspend-tenant.dto';
import { mergeSupportAuditMetadata } from './support-operator.util';

@Injectable()
export class SupportTenantAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly commerce: CommerceService,
    private readonly leaderLock: LeaderLockService,
    private readonly branchMenuCache: BranchMenuCacheInvalidationService,
  ) {}

  async patchCommerce(
    tenantId: string,
    dto: PatchSupportCommerceDto,
    supportOperator?: string,
  ) {
    const existing = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Tenant');
    }
    const data: Prisma.TenantUpdateInput = {};
    if (dto.subscriptionPlan !== undefined) {
      data.subscriptionPlan = dto.subscriptionPlan;
    }
    if (dto.billingStatus !== undefined) {
      data.billingStatus = dto.billingStatus;
    }
    if (dto.trialEndsAt !== undefined) {
      data.trialEndsAt =
        dto.trialEndsAt === null || dto.trialEndsAt === ''
          ? null
          : new Date(dto.trialEndsAt);
    }
    if (dto.currentPeriodEnd !== undefined) {
      data.currentPeriodEnd =
        dto.currentPeriodEnd === null || dto.currentPeriodEnd === ''
          ? null
          : new Date(dto.currentPeriodEnd);
    }
    if (dto.maxBranches !== undefined) {
      data.maxBranches = dto.maxBranches;
    }
    if (dto.maxUsers !== undefined) {
      data.maxUsers = dto.maxUsers;
    }
    if (dto.stripeCustomerId !== undefined) {
      data.stripeCustomerId = dto.stripeCustomerId;
    }
    if (dto.stripeSubscriptionId !== undefined) {
      data.stripeSubscriptionId = dto.stripeSubscriptionId;
    }
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });
    await this.audit.log({
      tenantId,
      action: 'support.commerce_patch',
      entity: 'tenant',
      entityId: tenantId,
      metadata: mergeSupportAuditMetadata({ patch: dto }, supportOperator),
    });
    await this.commerce.recordAnalyticsEvent(
      'tenant.commerce_updated',
      tenantId,
      {
        keys: Object.keys(dto),
      },
    );
    return updated;
  }

  async suspendTenant(
    tenantId: string,
    dto: SuspendTenantDto,
    supportOperator?: string,
  ) {
    const existing = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Tenant');
    }
    const prev = (existing.metadata as Record<string, unknown> | null) ?? {};
    const merged: Record<string, unknown> = {
      ...prev,
      previousBillingStatus: existing.billingStatus,
      suspensionReasonCode: dto.reasonCode,
      suspensionNote: dto.note?.trim() || undefined,
      suspendedAt: new Date().toISOString(),
    };
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        billingStatus: BillingStatus.suspended,
        metadata: merged as object,
      },
    });
    await this.audit.log({
      tenantId,
      action: 'support.suspend',
      entity: 'tenant',
      entityId: tenantId,
      metadata: mergeSupportAuditMetadata(
        {
          reasonCode: dto.reasonCode,
          note: dto.note,
          previousBillingStatus: existing.billingStatus,
        },
        supportOperator,
      ),
    });
    await this.commerce.recordAnalyticsEvent('tenant.suspended', tenantId, {
      reasonCode: dto.reasonCode,
    });
    return updated;
  }

  private resolveReactivateBillingStatus(existing: Tenant): BillingStatus {
    const meta = (existing.metadata as Record<string, unknown> | null) ?? {};
    const raw = meta.previousBillingStatus;
    const statuses = Object.values(BillingStatus) as string[];
    let next: BillingStatus = BillingStatus.active;
    if (typeof raw === 'string' && statuses.includes(raw)) {
      next = raw as BillingStatus;
    }
    if (next === BillingStatus.trialing) {
      const trialEnd = existing.trialEndsAt;
      if (trialEnd && trialEnd.getTime() < Date.now()) {
        next = BillingStatus.active;
      }
    }
    return next;
  }

  private stripReactivationKeys(
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    const next = { ...metadata };
    delete next.previousBillingStatus;
    delete next.suspensionReasonCode;
    delete next.suspensionNote;
    delete next.suspendedAt;
    delete next.blockReasonCode;
    delete next.blockDetail;
    return next;
  }

  async reactivateTenant(tenantId: string, supportOperator?: string) {
    const existing = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Tenant');
    }
    const nextStatus = this.resolveReactivateBillingStatus(existing);
    const meta = (existing.metadata as Record<string, unknown> | null) ?? {};
    const cleaned = this.stripReactivationKeys(meta);
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        billingStatus: nextStatus,
        metadata: cleaned as object,
      },
    });
    await this.audit.log({
      tenantId,
      action: 'support.reactivate',
      entity: 'tenant',
      entityId: tenantId,
      metadata: mergeSupportAuditMetadata(
        {
          restoredBillingStatus: nextStatus,
        },
        supportOperator,
      ),
    });
    await this.commerce.recordAnalyticsEvent('tenant.reactivated', tenantId, {
      billingStatus: nextStatus,
    });
    return updated;
  }

  async patchMetadata(
    tenantId: string,
    dto: PatchSupportMetadataDto,
    supportOperator?: string,
  ) {
    const existing = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Tenant');
    }
    const prev = (existing.metadata as Record<string, unknown> | null) ?? {};
    const merged = { ...prev, ...dto.metadata };
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: merged as object },
    });
    await this.audit.log({
      tenantId,
      action: 'support.metadata_patch',
      entity: 'tenant',
      entityId: tenantId,
      metadata: mergeSupportAuditMetadata(
        { keys: Object.keys(dto.metadata) },
        supportOperator,
      ),
    });
    return updated;
  }

  async runExpireTrialsJob() {
    const result = await this.leaderLock.tryRunExclusiveWithResult(
      'commerce_expire_due_trials',
      900,
      () => this.commerce.expireDueTrials(),
    );
    if (result === null) {
      return { updated: 0 };
    }
    return result;
  }

  async addTenantMember(
    tenantId: string,
    dto: CreateSupportTenantMemberDto,
    supportOperator?: string,
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

    const result = await this.prisma.$transaction(async (tx) => {
      await ensureGlobalPermissions(tx);
      await ensureRoleTemplatesForTenant(tx, tenantId);

      const role = await tx.role.findFirst({
        where: { tenantId, name: roleName },
      });
      if (!role) {
        throw new BadRequestException('ROLE_NOT_FOUND');
      }

      const existingMember = await tx.tenantMember.findFirst({
        where: { tenantId, user: { email } },
        include: {
          user: { select: { id: true, email: true, displayName: true } },
        },
      });
      if (existingMember) {
        return {
          idempotent: true as const,
          tenantMemberId: existingMember.id,
          userId: existingMember.userId,
          email: existingMember.user.email,
          displayName: existingMember.user.displayName,
          generatedPassword: undefined as string | undefined,
        };
      }

      const tenantForLimits = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
      });
      const limits = this.commerce.getEffectiveLimits(tenantForLimits);
      const memberCount = await tx.tenantMember.count({ where: { tenantId } });
      if (memberCount >= limits.maxUsers) {
        throw new BadRequestException('SEAT_LIMIT_REACHED');
      }

      const existingUser = await tx.user.findUnique({ where: { email } });
      let userId: string;
      let generatedPassword: string | undefined;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const plain =
          dto.password?.trim() ||
          crypto.randomBytes(12).toString('base64url').slice(0, 16);
        if (!dto.password?.trim()) {
          generatedPassword = plain;
        }
        const passwordHash = await hashPassword(plain);
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName:
              dto.displayName?.trim() || email.split('@')[0] || 'User',
          },
        });
        userId = created.id;
      }

      const member = await tx.tenantMember.create({
        data: {
          userId,
          tenantId,
          roleId: role.id,
          defaultBranchId: dto.defaultBranchId?.trim() || null,
        },
      });

      return {
        idempotent: false as const,
        tenantMemberId: member.id,
        userId,
        email,
        displayName: (
          await tx.user.findUniqueOrThrow({ where: { id: userId } })
        ).displayName,
        generatedPassword,
      };
    });

    if (!result.idempotent) {
      await this.audit.log({
        tenantId,
        branchId: dto.defaultBranchId?.trim() || undefined,
        action: 'support.tenant_member_create',
        entity: 'tenant_member',
        entityId: result.tenantMemberId,
        metadata: mergeSupportAuditMetadata(
          { email, role: roleName },
          supportOperator,
        ),
      });
    }

    return result;
  }

  async cloneBranchMenu(
    tenantId: string,
    targetBranchId: string,
    dto: CloneMenuDto,
    supportOperator?: string,
  ) {
    const sourceBranchId = dto.sourceBranchId.trim();
    if (sourceBranchId === targetBranchId) {
      throw new BadRequestException('SOURCE_EQUALS_TARGET');
    }
    const [src, tgt] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: sourceBranchId, tenantId },
      }),
      this.prisma.branch.findFirst({
        where: { id: targetBranchId, tenantId },
      }),
    ]);
    if (!src || !tgt) {
      throw new NotFoundException('Branch');
    }
    if (dto.mode !== 'replace_empty') {
      throw new BadRequestException('UNSUPPORTED_MODE');
    }

    const targetMenuCount = await this.prisma.menuItem.count({
      where: { branchId: targetBranchId },
    });
    if (targetMenuCount > 0) {
      throw new BadRequestException('TARGET_BRANCH_NOT_EMPTY');
    }

    const summary = await this.prisma.$transaction(async (tx) => {
      const groups = await tx.modifierGroup.findMany({
        where: { branchId: sourceBranchId },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      });
      const groupMap = new Map<string, string>();
      for (const g of groups) {
        const ng = await tx.modifierGroup.create({
          data: {
            branchId: targetBranchId,
            name: g.name,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            required: g.required,
            sortOrder: g.sortOrder,
          },
        });
        groupMap.set(g.id, ng.id);
        for (const o of g.options) {
          await tx.modifierOption.create({
            data: {
              groupId: ng.id,
              name: o.name,
              priceDelta: o.priceDelta,
              sortOrder: o.sortOrder,
            },
          });
        }
      }

      const categories = await tx.menuCategory.findMany({
        where: { branchId: sourceBranchId },
        orderBy: { sortOrder: 'asc' },
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
        },
      });

      const itemMap = new Map<string, string>();

      for (const c of categories) {
        const nc = await tx.menuCategory.create({
          data: {
            branchId: targetBranchId,
            name: c.name,
            sortOrder: c.sortOrder,
          },
        });
        for (const it of c.items) {
          const ni = await tx.menuItem.create({
            data: {
              branchId: targetBranchId,
              categoryId: nc.id,
              name: it.name,
              description: it.description,
              priceMinor: it.priceMinor,
              imageUrl: it.imageUrl,
              visible: it.visible,
              available: it.available,
              prepStation: it.prepStation,
              sortOrder: it.sortOrder,
            },
          });
          itemMap.set(it.id, ni.id);
        }
      }

      const sourceItems = await tx.menuItem.findMany({
        where: { branchId: sourceBranchId },
        include: { modifierGroups: true },
      });
      let modLinks = 0;
      for (const it of sourceItems) {
        const newItemId = itemMap.get(it.id);
        if (!newItemId) {
          continue;
        }
        for (const link of it.modifierGroups) {
          const newGroupId = groupMap.get(link.modifierGroupId);
          if (!newGroupId) {
            continue;
          }
          await tx.menuItemModifierGroup.create({
            data: {
              menuItemId: newItemId,
              modifierGroupId: newGroupId,
            },
          });
          modLinks += 1;
        }
      }

      const stocks = await tx.stockItem.findMany({
        where: { branchId: sourceBranchId },
        include: { recipes: true },
      });
      const stockMap = new Map<string, string>();
      for (const s of stocks) {
        const ns = await tx.stockItem.create({
          data: {
            branchId: targetBranchId,
            name: s.name,
            unit: s.unit,
            quantity: s.quantity,
            lowThreshold: s.lowThreshold,
          },
        });
        stockMap.set(s.id, ns.id);
      }
      let recipes = 0;
      for (const s of stocks) {
        for (const r of s.recipes) {
          const newItemId = itemMap.get(r.menuItemId);
          const newStockId = stockMap.get(r.stockItemId);
          if (!newItemId || !newStockId) {
            continue;
          }
          await tx.itemRecipe.create({
            data: {
              menuItemId: newItemId,
              stockItemId: newStockId,
              qtyPerUnit: r.qtyPerUnit,
            },
          });
          recipes += 1;
        }
      }

      return {
        categoriesCopied: categories.length,
        itemsCopied: itemMap.size,
        modifierGroupsCopied: groups.length,
        modifierLinksCopied: modLinks,
        stockItemsCopied: stocks.length,
        recipesCopied: recipes,
      };
    });

    await this.audit.log({
      tenantId,
      branchId: targetBranchId,
      action: 'support.clone_menu',
      entity: 'branch',
      entityId: targetBranchId,
      metadata: mergeSupportAuditMetadata(
        {
          sourceBranchId,
          ...summary,
        },
        supportOperator,
      ),
    });

    await this.branchMenuCache.invalidateBranch(targetBranchId);

    return { ok: true as const, ...summary };
  }
}
