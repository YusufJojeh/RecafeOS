import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addDays } from 'date-fns';
import { CommerceService } from '../../commerce/commerce.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { PatchBranchDto } from './dto/patch-branch.dto';
import type { PatchOnboardingUiDto } from './dto/patch-onboarding-ui.dto';

export type OnboardingStepTier = 'blocking' | 'recommended';

export type RecommendedSnoozeEntry = {
  until?: string;
  dismissed?: boolean;
};

export type OnboardingUiState = {
  recommendedSnoozes?: Record<string, RecommendedSnoozeEntry>;
  goLiveAcknowledgedAt?: string;
};

export type OnboardingStepDetail = {
  id: string;
  label: string;
  done: boolean;
  tier: OnboardingStepTier;
  why: string;
  /** In-app path for staff navigation (ops-web). */
  nextPath: string;
  /** Present when this recommended step is snoozed or dismissed for UX. */
  snoozedUntil?: string | null;
  dismissed?: boolean;
};

export type OnboardingStatusPayload = {
  branchId: string;
  branchSlug: string;
  tenantSlug: string;
  publicMenuUrlTemplate: string | null;
  /** True when `APP_PUBLIC_URL` is set on the API (guest link pattern can be built). */
  appPublicUrlConfigured: boolean;
  steps: OnboardingStepDetail[];
  progressPercent: number;
  /** Blocking steps not yet done. */
  blockingIncompleteCount: number;
  /** All blocking steps complete (pilot “product ready” for go-live signoff). */
  readyForGoLive: boolean;
  /** ISO timestamp when an owner/manager recorded product go-live acknowledgment (optional). */
  goLiveAcknowledgedAt: string | null;
};

const ONBOARDING_UI_KEY = 'onboardingUi';

function parseOnboardingUi(
  settings: Record<string, unknown>,
): OnboardingUiState {
  const raw = settings[ONBOARDING_UI_KEY];
  if (!raw || typeof raw !== 'object' || raw === null) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const recommendedSnoozes =
    o.recommendedSnoozes &&
    typeof o.recommendedSnoozes === 'object' &&
    o.recommendedSnoozes !== null
      ? (o.recommendedSnoozes as Record<string, RecommendedSnoozeEntry>)
      : undefined;
  const goLiveAcknowledgedAt =
    typeof o.goLiveAcknowledgedAt === 'string'
      ? o.goLiveAcknowledgedAt
      : undefined;
  return { recommendedSnoozes, goLiveAcknowledgedAt };
}

function isRecommendedSnoozeActive(
  entry: RecommendedSnoozeEntry | undefined,
  now: Date,
): { snoozedUntil: string | null; dismissed: boolean } {
  if (!entry) {
    return { snoozedUntil: null, dismissed: false };
  }
  if (entry.dismissed === true) {
    return { snoozedUntil: null, dismissed: true };
  }
  if (entry.until) {
    const t = new Date(entry.until);
    if (!Number.isNaN(t.getTime()) && t > now) {
      return { snoozedUntil: entry.until, dismissed: false };
    }
  }
  return { snoozedUntil: null, dismissed: false };
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly commerce: CommerceService,
    private readonly audit: AuditService,
  ) {}

  /**
   * All branches for the tenant. There is no per-member branch ACL yet — any
   * `TenantMember` may select any branch; `BranchGuard` only checks tenant ownership.
   */
  listForTenant(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  /** Minimal branch list for support console (no JWT). */
  listBranchSummariesForTenant(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        currency: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Combined branch + tenant commerce read model for setup visibility (settings.manage). */
  async getConfigSnapshot(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      include: { tenant: { select: { slug: true, name: true } } },
    });
    if (!branch) {
      throw new NotFoundException('Branch');
    }
    const commerce = await this.commerce.getCommerceReadModel(tenantId);
    const publicBase =
      this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ?? '';
    const appPublicUrlConfigured = publicBase.length > 0;
    const settings = (branch.settings as Record<string, unknown> | null) ?? {};
    const onboardingUi = parseOnboardingUi(settings);
    return {
      branch: {
        id: branch.id,
        name: branch.name,
        slug: branch.slug,
        timezone: branch.timezone,
        currency: branch.currency,
        settings: {
          qrOrderingEnabled: settings['qrOrderingEnabled'] === true,
          qrCallWaiterEnabled: settings['qrCallWaiterEnabled'] === true,
        },
      },
      tenant: {
        slug: branch.tenant.slug,
        name: branch.tenant.name,
      },
      environment: {
        appPublicUrlConfigured,
        publicMenuUrlTemplate: publicBase
          ? `${publicBase}/m/${branch.tenant.slug}/${branch.slug}/t/{sessionToken}`
          : null,
      },
      onboardingUi,
      commerce,
    };
  }

  /** Safe branch edits for venue operators (not provision / slug changes). */
  async patchBranchSafe(
    tenantId: string,
    branchId: string,
    actorId: string,
    dto: PatchBranchDto,
  ) {
    if (
      dto.name === undefined &&
      dto.qrOrderingEnabled === undefined &&
      dto.qrCallWaiterEnabled === undefined
    ) {
      throw new BadRequestException('NO_CHANGES');
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException('Branch');
    }
    const prev = (branch.settings as Record<string, unknown> | null) ?? {};
    const nextSettings: Record<string, unknown> = { ...prev };
    if (dto.qrOrderingEnabled !== undefined) {
      nextSettings['qrOrderingEnabled'] = dto.qrOrderingEnabled;
    }
    if (dto.qrCallWaiterEnabled !== undefined) {
      nextSettings['qrCallWaiterEnabled'] = dto.qrCallWaiterEnabled;
    }
    const updated = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        settings: nextSettings as object,
      },
    });
    await this.audit.log({
      tenantId,
      branchId,
      actorId,
      action: 'branch.settings_patch',
      entity: 'branch',
      entityId: branchId,
      metadata: {
        fields: {
          name: dto.name !== undefined,
          qrOrderingEnabled: dto.qrOrderingEnabled !== undefined,
          qrCallWaiterEnabled: dto.qrCallWaiterEnabled !== undefined,
        },
      },
    });
    return updated;
  }

  async patchOnboardingUi(
    tenantId: string,
    branchId: string,
    actorId: string,
    dto: PatchOnboardingUiDto,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException('Branch');
    }
    const settings = (branch.settings as Record<string, unknown> | null) ?? {};
    const ui = parseOnboardingUi(settings);
    const snoozes = { ...(ui.recommendedSnoozes ?? {}) };
    if (dto.clear === true) {
      delete snoozes[dto.stepId];
    } else if (dto.dismiss === true) {
      snoozes[dto.stepId] = { dismissed: true };
    } else if (dto.snoozeDays != null) {
      const until = addDays(new Date(), dto.snoozeDays).toISOString();
      snoozes[dto.stepId] = { until };
    } else {
      throw new BadRequestException('SNOOZE_DAYS_DISMISS_OR_CLEAR');
    }
    const nextOnboarding: OnboardingUiState = {
      ...ui,
      recommendedSnoozes: snoozes,
    };
    const nextSettings = {
      ...settings,
      [ONBOARDING_UI_KEY]: nextOnboarding as object,
    };
    await this.prisma.branch.update({
      where: { id: branchId },
      data: { settings: nextSettings as object },
    });
    await this.audit.log({
      tenantId,
      branchId,
      actorId,
      action: 'branch.onboarding_ui_patch',
      entity: 'branch',
      entityId: branchId,
      metadata: { stepId: dto.stepId, clear: dto.clear, dismiss: dto.dismiss },
    });
    return this.getOnboardingStatus(tenantId, branchId);
  }

  async acknowledgeGoLive(
    tenantId: string,
    branchId: string,
    actorId: string,
    confirm: boolean,
  ) {
    if (!confirm) {
      throw new BadRequestException('CONFIRM_REQUIRED');
    }
    const payload = await this.buildOnboardingPayload(tenantId, branchId);
    if (!payload.readyForGoLive) {
      throw new BadRequestException({
        message: 'BLOCKING_STEPS_INCOMPLETE',
        blockingIncompleteCount: payload.blockingIncompleteCount,
      });
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException('Branch');
    }
    const settings = (branch.settings as Record<string, unknown> | null) ?? {};
    const ui = parseOnboardingUi(settings);
    const at = new Date().toISOString();
    const nextOnboarding: OnboardingUiState = {
      ...ui,
      goLiveAcknowledgedAt: at,
    };
    const nextSettings = {
      ...settings,
      [ONBOARDING_UI_KEY]: nextOnboarding as object,
    };
    await this.prisma.branch.update({
      where: { id: branchId },
      data: { settings: nextSettings as object },
    });
    await this.audit.log({
      tenantId,
      branchId,
      actorId,
      action: 'branch.go_live_ack',
      entity: 'branch',
      entityId: branchId,
      metadata: { acknowledgedAt: at },
    });
    return { ok: true as const, acknowledgedAt: at };
  }

  /** Minimal readiness for any branch member (Floor banner); no settings.manage required. */
  async getSetupReadiness(
    tenantId: string,
    branchId: string,
  ): Promise<{ readyForGoLive: boolean; blockingIncompleteCount: number }> {
    const full = await this.buildOnboardingPayload(tenantId, branchId);
    return {
      readyForGoLive: full.readyForGoLive,
      blockingIncompleteCount: full.blockingIncompleteCount,
    };
  }

  /**
   * Operational snapshot for the Floor strip: go-live readiness (blocking steps
   * only), low-stock count, open shift. Does **not** build the full onboarding
   * checklist (unlike `getOnboardingStatus`).
   */
  async getOpsSnapshot(
    tenantId: string,
    branchId: string,
  ): Promise<{
    readyForGoLive: boolean;
    blockingIncompleteCount: number;
    lowStockCount: number;
    openShiftPresent: boolean;
  }> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true, settings: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch');
    }
    const settings = (branch.settings as Record<string, unknown> | null) ?? {};
    const publicBase =
      this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ?? '';
    const appPublicUrlConfigured = publicBase.length > 0;

    const [menuCount, tableCount, recentPaidOrder, lowStockRows, openShift] =
      await Promise.all([
        this.prisma.menuItem.count({ where: { branchId } }),
        this.prisma.floorTable.count({ where: { branchId } }),
        this.prisma.order.findFirst({
          where: { branchId, status: 'PAID' },
          orderBy: { paidAt: 'desc' },
          select: { id: true },
        }),
        this.prisma.stockItem.findMany({
          where: { branchId, branch: { tenantId } },
          select: { quantity: true, lowThreshold: true },
        }),
        this.prisma.shift.findFirst({
          where: { branchId, closedAt: null },
          select: { id: true },
        }),
      ]);

    const { readyForGoLive, blockingIncompleteCount } =
      this.blockingGoLiveFromInputs(settings, {
        appPublicUrlConfigured,
        menuCount,
        tableCount,
        recentPaidOrder,
      });
    const lowStockCount = lowStockRows.filter(
      (row) => Number(row.quantity) <= Number(row.lowThreshold),
    ).length;
    return {
      readyForGoLive,
      blockingIncompleteCount,
      lowStockCount,
      openShiftPresent: openShift != null,
    };
  }

  /** Setup checklist for onboarding UI (computed from branch + counts). */
  async getOnboardingStatus(
    tenantId: string,
    branchId: string,
  ): Promise<OnboardingStatusPayload> {
    return this.buildOnboardingPayload(tenantId, branchId);
  }

  /**
   * Blocking go-live steps only — must stay aligned with `baseSteps` blocking
   * rows in `buildOnboardingPayload`.
   */
  private blockingGoLiveFromInputs(
    settings: Record<string, unknown>,
    input: {
      appPublicUrlConfigured: boolean;
      menuCount: number;
      tableCount: number;
      recentPaidOrder: { id: string } | null;
    },
  ): { readyForGoLive: boolean; blockingIncompleteCount: number } {
    const blockingDone = [
      input.appPublicUrlConfigured,
      input.menuCount > 0,
      input.tableCount > 0,
      settings['qrOrderingEnabled'] === true,
      input.recentPaidOrder != null,
    ];
    const blockingIncompleteCount = blockingDone.filter((d) => !d).length;
    return {
      readyForGoLive: blockingIncompleteCount === 0,
      blockingIncompleteCount,
    };
  }

  private async buildOnboardingPayload(
    tenantId: string,
    branchId: string,
  ): Promise<OnboardingStatusPayload> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      include: { tenant: { select: { slug: true } } },
    });
    if (!branch) {
      throw new NotFoundException('Branch');
    }
    const settings = (branch.settings as Record<string, unknown> | null) ?? {};
    const onboardingUi = parseOnboardingUi(settings);
    const now = new Date();
    const [menuCount, tableCount, openSessions, recentPaidOrder] =
      await Promise.all([
        this.prisma.menuItem.count({ where: { branchId } }),
        this.prisma.floorTable.count({ where: { branchId } }),
        this.prisma.tableSession.count({
          where: { branchId, status: 'OPEN' },
        }),
        this.prisma.order.findFirst({
          where: {
            branchId,
            status: 'PAID',
          },
          orderBy: { paidAt: 'desc' },
          select: { id: true },
        }),
      ]);

    const publicBase =
      this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ?? '';
    const appPublicUrlConfigured = publicBase.length > 0;

    const baseSteps: Omit<
      OnboardingStepDetail,
      'snoozedUntil' | 'dismissed'
    >[] = [
      {
        id: 'appPublicUrl',
        label: 'API public URL for guest menu (APP_PUBLIC_URL)',
        done: appPublicUrlConfigured,
        tier: 'blocking',
        why: 'Without this, guest QR links cannot be formed; set on the API to match the staff app origin.',
        nextPath: '/setup',
      },
      {
        id: 'menu',
        label: 'At least one menu item',
        done: menuCount > 0,
        tier: 'blocking',
        why: 'Orders need sellable items.',
        nextPath: '/menu',
      },
      {
        id: 'tables',
        label: 'Floor tables created',
        done: tableCount > 0,
        tier: 'blocking',
        why: 'Dine-in and table sessions need tables.',
        nextPath: '/floor',
      },
      {
        id: 'qrSettings',
        label: 'QR ordering enabled in branch settings',
        done: settings['qrOrderingEnabled'] === true,
        tier: 'blocking',
        why: 'Guest ordering from QR must be allowed for the pilot flow.',
        nextPath: '/setup',
      },
      {
        id: 'session',
        label: 'Open table session (for guest QR)',
        done: openSessions > 0,
        tier: 'recommended',
        why: 'Needed to test the real guest URL before opening hours.',
        nextPath: '/floor',
      },
      {
        id: 'smokeOrder',
        label: 'Completed payment (smoke test)',
        done: recentPaidOrder != null,
        tier: 'blocking',
        why: 'Confirms close-bill and payment path before go-live.',
        nextPath: '/floor',
      },
    ];

    const steps: OnboardingStepDetail[] = baseSteps.map((s) => {
      if (s.tier !== 'recommended') {
        return { ...s };
      }
      const entry = onboardingUi.recommendedSnoozes?.[s.id];
      const { snoozedUntil, dismissed } = isRecommendedSnoozeActive(entry, now);
      return {
        ...s,
        snoozedUntil: snoozedUntil ?? null,
        dismissed: dismissed || undefined,
      };
    });

    const eligibleForProgress = steps.filter((s) => {
      if (s.done) {
        return true;
      }
      if (s.tier === 'blocking') {
        return true;
      }
      if (s.tier === 'recommended') {
        if (s.dismissed) {
          return false;
        }
        if (s.snoozedUntil && new Date(s.snoozedUntil) > now) {
          return false;
        }
      }
      return true;
    });
    const doneEligible = eligibleForProgress.filter((s) => s.done).length;
    const { blockingIncompleteCount, readyForGoLive } =
      this.blockingGoLiveFromInputs(settings, {
        appPublicUrlConfigured,
        menuCount,
        tableCount,
        recentPaidOrder,
      });

    return {
      branchId: branch.id,
      branchSlug: branch.slug,
      tenantSlug: branch.tenant.slug,
      appPublicUrlConfigured,
      publicMenuUrlTemplate: publicBase
        ? `${publicBase}/m/${branch.tenant.slug}/${branch.slug}/t/{sessionToken}`
        : null,
      steps,
      progressPercent:
        eligibleForProgress.length === 0
          ? 0
          : Math.round((doneEligible / eligibleForProgress.length) * 100),
      blockingIncompleteCount,
      readyForGoLive,
      goLiveAcknowledgedAt: onboardingUi.goLiveAcknowledgedAt ?? null,
    };
  }
}
