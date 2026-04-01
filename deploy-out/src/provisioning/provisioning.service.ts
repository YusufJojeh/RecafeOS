import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillingStatus, SubscriptionPlan } from '@prisma/client';
import { addDays } from 'date-fns';
import * as crypto from 'crypto';
import { BranchMenuCacheInvalidationService } from '../common/menu-cache/branch-menu-cache-invalidation.service';
import { CommerceService } from '../commerce/commerce.service';
import { AuditService } from '../modules/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createFloorTables,
  createSampleMenuAndStock,
  ensureGlobalPermissions,
  ensureRoleTemplatesForTenant,
  hashPassword,
} from './provisioning.helpers';
import { mergeSupportAuditMetadata } from '../modules/support/support-operator.util';

const DEFAULT_BRANCH_SETTINGS = {
  qrOrderingEnabled: true,
  qrCallWaiterEnabled: true,
};

export type ProvisionTenantInput = {
  tenantName: string;
  tenantSlug: string;
  branchName: string;
  branchSlug: string;
  timezone: string;
  currency: string;
  ownerEmail: string;
  ownerPassword?: string;
  ownerDisplayName?: string;
  includeSampleMenu: boolean;
  tableCount: number;
  trial?: boolean;
  trialDays?: number;
  /** Optional human id for audit (support API `x-support-operator`). */
  supportOperator?: string;
};

export type ProvisionTenantResult = {
  tenantId: string;
  branchId: string;
  tenantSlug: string;
  branchSlug: string;
  ownerUserId: string;
  ownerEmail: string;
  /** Present only when a new user was created and no password was supplied. */
  generatedPassword?: string;
};

function generatePassword(): string {
  return crypto.randomBytes(12).toString('base64url').slice(0, 16);
}

@Injectable()
export class ProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly commerce: CommerceService,
    private readonly branchMenuCache: BranchMenuCacheInvalidationService,
  ) {}

  async provisionTenant(
    input: ProvisionTenantInput,
  ): Promise<ProvisionTenantResult> {
    const email = input.ownerEmail.toLowerCase().trim();

    const result = await this.prisma.$transaction(async (tx) => {
      await ensureGlobalPermissions(tx);

      const trialDays = input.trialDays ?? this.commerce.getDefaultTrialDays();
      const tenant = await tx.tenant.upsert({
        where: { slug: input.tenantSlug },
        update: { name: input.tenantName },
        create: {
          name: input.tenantName,
          slug: input.tenantSlug,
          subscriptionPlan: input.trial
            ? SubscriptionPlan.trial
            : SubscriptionPlan.starter,
          billingStatus: input.trial
            ? BillingStatus.trialing
            : BillingStatus.active,
          trialEndsAt: input.trial ? addDays(new Date(), trialDays) : null,
        },
      });

      const tenantRow = await tx.tenant.findUniqueOrThrow({
        where: { id: tenant.id },
      });
      const limits = this.commerce.getEffectiveLimits(tenantRow);
      const existingBranch = await tx.branch.findUnique({
        where: {
          tenantId_slug: { tenantId: tenant.id, slug: input.branchSlug },
        },
      });
      const branchesCount = await tx.branch.count({
        where: { tenantId: tenant.id },
      });
      if (!existingBranch && branchesCount >= limits.maxBranches) {
        throw new BadRequestException(
          'BRANCH_LIMIT_REACHED: plan branch cap reached — confirm contract/maxBranches and follow docs/growth/BRANCH_ROLLOUT_MODEL.md before provisioning another site.',
        );
      }

      const branch = await tx.branch.upsert({
        where: {
          tenantId_slug: { tenantId: tenant.id, slug: input.branchSlug },
        },
        update: {
          name: input.branchName,
          timezone: input.timezone,
          currency: input.currency,
        },
        create: {
          tenantId: tenant.id,
          name: input.branchName,
          slug: input.branchSlug,
          timezone: input.timezone,
          currency: input.currency,
          settings: DEFAULT_BRANCH_SETTINGS,
        },
      });

      const { ownerRoleId } = await ensureRoleTemplatesForTenant(tx, tenant.id);

      let generatedPassword: string | undefined;
      const existingUser = await tx.user.findUnique({
        where: { email },
      });

      let userId: string;
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const plain = input.ownerPassword?.trim()
          ? input.ownerPassword.trim()
          : (() => {
              const p = generatePassword();
              generatedPassword = p;
              return p;
            })();
        const passwordHash = await hashPassword(plain);
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName:
              input.ownerDisplayName?.trim() || `${input.tenantName} Owner`,
          },
        });
        userId = created.id;
      }

      await tx.tenantMember.upsert({
        where: {
          userId_tenantId: { userId, tenantId: tenant.id },
        },
        update: {
          roleId: ownerRoleId,
          defaultBranchId: branch.id,
        },
        create: {
          userId,
          tenantId: tenant.id,
          roleId: ownerRoleId,
          defaultBranchId: branch.id,
        },
      });

      const memberCount = await tx.tenantMember.count({
        where: { tenantId: tenant.id },
      });
      const tenantForLimits = await tx.tenant.findUniqueOrThrow({
        where: { id: tenant.id },
      });
      const seatLimits = this.commerce.getEffectiveLimits(tenantForLimits);
      if (memberCount > seatLimits.maxUsers) {
        throw new BadRequestException('SEAT_LIMIT_REACHED');
      }

      const menuCount = await tx.menuItem.count({
        where: { branchId: branch.id },
      });
      if (input.includeSampleMenu && menuCount === 0) {
        await createSampleMenuAndStock(tx, branch.id);
      }

      const tableCount = await tx.floorTable.count({
        where: { branchId: branch.id },
      });
      if (input.tableCount > 0 && tableCount === 0) {
        await createFloorTables(tx, branch.id, input.tableCount);
      }

      return {
        tenantId: tenant.id,
        branchId: branch.id,
        tenantSlug: tenant.slug,
        branchSlug: branch.slug,
        ownerUserId: userId,
        ownerEmail: email,
        generatedPassword,
      };
    });

    await this.branchMenuCache.invalidateBranch(result.branchId);

    await this.audit.log({
      tenantId: result.tenantId,
      branchId: result.branchId,
      action: 'support.provision',
      entity: 'tenant',
      entityId: result.tenantId,
      metadata: mergeSupportAuditMetadata(
        {
          tenantSlug: result.tenantSlug,
          branchSlug: result.branchSlug,
          trial: input.trial ?? false,
          includeSampleMenu: input.includeSampleMenu,
          tableCount: input.tableCount,
        },
        input.supportOperator,
      ),
    });

    await this.commerce.recordAnalyticsEvent(
      'tenant.provisioned',
      result.tenantId,
      {
        tenantSlug: result.tenantSlug,
        trial: input.trial ?? false,
      },
    );

    return result;
  }

  /**
   * Removes transactional data for a branch (orders, sessions, payments, etc.)
   * while keeping menu, tables, catalog, and staff.
   */
  async resetDemoBranch(
    tenantId: string,
    branchId: string,
    options?: {
      acknowledgeProductionReset?: boolean;
      supportOperator?: string;
    },
  ): Promise<{
    deletedOrders: number;
    deletedSessions: number;
    deletedStockMovements: number;
  }> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant');
    }
    const meta = (tenant.metadata as Record<string, unknown> | null) ?? {};
    const isDemo = meta.demo === true;
    if (!isDemo && options?.acknowledgeProductionReset !== true) {
      throw new BadRequestException(
        'RESET_DEMO_REQUIRES_DEMO_TAG_OR_ACK: set metadata.demo=true or pass acknowledgeProductionReset',
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found for tenant');
    }

    const counts = await this.prisma.$transaction(async (tx) => {
      await tx.waiterCall.deleteMany({ where: { branchId } });

      const ordersBefore = await tx.order.count({ where: { branchId } });
      await tx.order.deleteMany({ where: { branchId } });

      const sm = await tx.stockMovement.deleteMany({ where: { branchId } });
      await tx.customerVisit.deleteMany({ where: { branchId } });

      const sessionsBefore = await tx.tableSession.count({
        where: { branchId },
      });
      await tx.tableSession.deleteMany({ where: { branchId } });

      await tx.shift.deleteMany({ where: { branchId } });

      return {
        deletedOrders: ordersBefore,
        deletedSessions: sessionsBefore,
        deletedStockMovements: sm.count,
      };
    });

    await this.audit.log({
      tenantId,
      branchId,
      action: 'support.reset_demo',
      entity: 'branch',
      entityId: branchId,
      metadata: mergeSupportAuditMetadata(
        { ...counts },
        options?.supportOperator,
      ),
    });

    return counts;
  }
}
