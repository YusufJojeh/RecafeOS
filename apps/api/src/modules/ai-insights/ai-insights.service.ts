import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { CommerceService } from '../../commerce/commerce.service';
import type { PlanFeatures } from '../../commerce/plan-limits.config';
import { calendarDateInTimeZone } from '../../common/datetime/branch-day-range';
import { BranchLookupService } from '../../common/branch/branch-lookup.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { parseDailySummaryJson } from './daily-summary-response.schema';
import { DAILY_SUMMARY_SYSTEM_PROMPT } from './daily-summary.prompt';
import { buildBranchCompareInsightSnapshot } from './branch-compare-snapshot';
import { BRANCH_COMPARE_SYSTEM_PROMPT } from './branch-compare.prompt';
import { buildDailyInsightSnapshot } from './insight-snapshot';
import { buildLowStockInsightSnapshot } from './low-stock-snapshot';
import { LOW_STOCK_SYSTEM_PROMPT } from './low-stock.prompt';
import { buildUnderperformersInsightSnapshot } from './underperformers-snapshot';
import { UNDERPERFORMERS_SYSTEM_PROMPT } from './underperformers.prompt';
import { buildWeeklyDigestInsightSnapshot } from './weekly-digest-snapshot';
import { WEEKLY_DIGEST_SYSTEM_PROMPT } from './weekly-digest.prompt';
import {
  BRANCH_COMPARE_PROMPT_VERSION,
  BRANCH_COMPARE_SNAPSHOT_VERSION,
  DAILY_SUMMARY_PROMPT_VERSION,
  INSIGHT_SNAPSHOT_VERSION,
  LOW_STOCK_PROMPT_VERSION,
  LOW_STOCK_SNAPSHOT_VERSION,
  UNDERPERFORMERS_PROMPT_VERSION,
  UNDERPERFORMERS_SNAPSHOT_VERSION,
  WEEKLY_DIGEST_PROMPT_VERSION,
  WEEKLY_DIGEST_SNAPSHOT_VERSION,
} from './llm.constants';
import type { LlmClient } from './llm-client.interface';
import { LLM_CLIENT } from './llm.types';
import { LlmTaskKind } from './llm.types';
import type { AiInsightsFeatureKey } from './tenant-ai-metadata';
import {
  tenantAiFeatureEnabled,
  tenantAiInsightsEnabled,
} from './tenant-ai-metadata';

export type AiInsightBlockedReason =
  | 'tenant_opt_in_required'
  | 'tenant_feature_opt_in_required'
  | 'plan_not_eligible'
  | 'cap_exceeded'
  | 'llm_unavailable'
  | 'llm_parse_failed'
  | 'llm_error';

export type DailySummaryResult =
  | {
      available: true;
      snapshotVersion: string;
      promptVersion: string;
      date: string;
      body: {
        summary: string;
        highlights?: string[];
        cautions?: string[];
      };
      model?: string;
    }
  | {
      available: false;
      reason: AiInsightBlockedReason;
      snapshotVersion: string;
      promptVersion: string;
      date: string;
      detail?: string;
    };

export type WeeklyDigestNarrativeResult =
  | {
      available: true;
      snapshotVersion: string;
      promptVersion: string;
      digestEndDay: string;
      branchId: string;
      body: {
        summary: string;
        highlights?: string[];
        cautions?: string[];
      };
      model?: string;
    }
  | {
      available: false;
      reason: AiInsightBlockedReason;
      snapshotVersion: string;
      promptVersion: string;
      digestEndDay: string;
      branchId: string;
      detail?: string;
    };

export type LowStockCommentaryResult =
  | {
      available: true;
      snapshotVersion: string;
      promptVersion: string;
      date: string;
      branchId: string;
      body: {
        summary: string;
        highlights?: string[];
        cautions?: string[];
      };
      model?: string;
    }
  | {
      available: false;
      reason: AiInsightBlockedReason;
      snapshotVersion: string;
      promptVersion: string;
      date: string;
      branchId: string;
      detail?: string;
    };

export type UnderperformersNarrativeResult =
  | {
      available: true;
      snapshotVersion: string;
      promptVersion: string;
      digestEndDay: string;
      branchId: string;
      body: {
        summary: string;
        highlights?: string[];
        cautions?: string[];
      };
      model?: string;
    }
  | {
      available: false;
      reason: AiInsightBlockedReason;
      snapshotVersion: string;
      promptVersion: string;
      digestEndDay: string;
      branchId: string;
      detail?: string;
    };

export type BranchCompareNarrativeResult =
  | {
      available: true;
      snapshotVersion: string;
      promptVersion: string;
      date: string;
      branchId: string;
      body: {
        summary: string;
        highlights?: string[];
        cautions?: string[];
      };
      model?: string;
    }
  | {
      available: false;
      reason: AiInsightBlockedReason;
      snapshotVersion: string;
      promptVersion: string;
      date: string;
      branchId: string;
      detail?: string;
    };

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);
  private readonly insightRequestCounts = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchLookupService,
    private readonly reports: ReportsService,
    private readonly config: ConfigService,
    private readonly commerce: CommerceService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
  ) {}

  private parseCap(envKey: string, fallback: number, hardMax: number): number {
    const raw = this.config.get<string>(envKey);
    const n = raw ? parseInt(raw, 10) : fallback;
    const v = Number.isFinite(n) ? n : fallback;
    return Math.min(hardMax, Math.max(1, v));
  }

  private takeCapSlot(key: string, max: number): boolean {
    const used = this.insightRequestCounts.get(key) ?? 0;
    if (used >= max) {
      return false;
    }
    this.insightRequestCounts.set(key, used + 1);
    return true;
  }

  private gate(
    tenant: Pick<
      Tenant,
      'subscriptionPlan' | 'maxBranches' | 'maxUsers' | 'metadata'
    >,
    planFeature: keyof PlanFeatures,
    featureKey: AiInsightsFeatureKey,
  ):
    | { ok: true }
    | {
        ok: false;
        reason:
          | 'plan_not_eligible'
          | 'tenant_opt_in_required'
          | 'tenant_feature_opt_in_required';
        detail?: string;
      } {
    if (!this.commerce.isPlanFeatureEnabled(tenant, planFeature)) {
      return {
        ok: false,
        reason: 'plan_not_eligible',
        detail:
          'This feature is not included in the current subscription plan.',
      };
    }
    if (!tenantAiInsightsEnabled(tenant.metadata ?? null)) {
      return { ok: false, reason: 'tenant_opt_in_required' };
    }
    if (!tenantAiFeatureEnabled(tenant.metadata ?? null, featureKey)) {
      return {
        ok: false,
        reason: 'tenant_feature_opt_in_required',
        detail: `Tenant has not opted in to this AI feature (${featureKey}).`,
      };
    }
    return { ok: true };
  }

  async dailySummaryExplanation(
    branchId: string,
    tenantId: string,
    dateInput?: string,
  ): Promise<DailySummaryResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        metadata: true,
        subscriptionPlan: true,
        maxBranches: true,
        maxUsers: true,
      },
    });

    const dailyPreview = await this.reports.daily(
      branchId,
      tenantId,
      dateInput,
    );

    if (!tenant) {
      this.logger.log(
        JSON.stringify({
          msg: 'ai_insights_daily_summary',
          tenantId,
          branchId,
          available: false,
          reason: 'plan_not_eligible',
          plan: null,
        }),
      );
      return {
        available: false,
        reason: 'plan_not_eligible',
        snapshotVersion: INSIGHT_SNAPSHOT_VERSION,
        promptVersion: DAILY_SUMMARY_PROMPT_VERSION,
        date: dailyPreview.date,
        detail: 'Tenant not found.',
      };
    }

    const g = this.gate(tenant, 'aiDailySummary', 'dailySummary');
    if (!g.ok) {
      this.logger.log(
        JSON.stringify({
          msg: 'ai_insights_daily_summary',
          tenantId,
          branchId,
          available: false,
          reason: g.reason,
          plan: tenant.subscriptionPlan,
        }),
      );
      return {
        available: false,
        reason: g.reason,
        snapshotVersion: INSIGHT_SNAPSHOT_VERSION,
        promptVersion: DAILY_SUMMARY_PROMPT_VERSION,
        date: dailyPreview.date,
        detail: g.detail,
      };
    }

    const branch = await this.branches.findOrThrow(branchId, tenantId);
    const snapshot = buildDailyInsightSnapshot(dailyPreview, {
      id: branch.id,
      name: branch.name,
      timezone: branch.timezone,
    });

    const capKey = `${tenantId}:${branchId}:${dailyPreview.date}:daily`;
    const maxPerDay = this.parseCap(
      'LLM_INSIGHTS_MAX_PER_BRANCH_PER_DAY',
      24,
      500,
    );
    if (!this.takeCapSlot(capKey, maxPerDay)) {
      this.logger.log(
        JSON.stringify({
          msg: 'ai_insights_daily_summary',
          tenantId,
          branchId,
          available: false,
          reason: 'cap_exceeded',
          capKey,
          maxPerDay,
        }),
      );
      return {
        available: false,
        reason: 'cap_exceeded',
        snapshotVersion: INSIGHT_SNAPSHOT_VERSION,
        promptVersion: DAILY_SUMMARY_PROMPT_VERSION,
        date: dailyPreview.date,
        detail: `Maximum ${maxPerDay} AI insight request(s) per branch per report day.`,
      };
    }

    const result = await this.llm.completeStructured({
      taskKind: LlmTaskKind.DAILY_SUMMARY_EXPLAIN,
      promptVersion: DAILY_SUMMARY_PROMPT_VERSION,
      messages: [
        { role: 'system', content: DAILY_SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(snapshot) },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    if (!result.ok) {
      this.logger.warn(
        { branchId, tenantId, reason: result.reason },
        'AI daily summary LLM unavailable',
      );
      return {
        available: false,
        reason: 'llm_unavailable',
        snapshotVersion: INSIGHT_SNAPSHOT_VERSION,
        promptVersion: DAILY_SUMMARY_PROMPT_VERSION,
        date: dailyPreview.date,
        detail: result.detail ?? result.reason,
      };
    }

    const parsed = parseDailySummaryJson(result.text);
    if (!parsed) {
      this.logger.warn({ branchId, tenantId }, 'AI daily summary parse failed');
      return {
        available: false,
        reason: 'llm_parse_failed',
        snapshotVersion: INSIGHT_SNAPSHOT_VERSION,
        promptVersion: DAILY_SUMMARY_PROMPT_VERSION,
        date: dailyPreview.date,
      };
    }

    this.logger.log(
      JSON.stringify({
        msg: 'ai_insights_daily_summary',
        tenantId,
        branchId,
        available: true,
        date: dailyPreview.date,
        model: result.model ?? null,
      }),
    );
    return {
      available: true,
      snapshotVersion: INSIGHT_SNAPSHOT_VERSION,
      promptVersion: DAILY_SUMMARY_PROMPT_VERSION,
      date: dailyPreview.date,
      body: parsed,
      model: result.model,
    };
  }

  async weeklyDigestNarrative(
    branchId: string,
    tenantId: string,
  ): Promise<WeeklyDigestNarrativeResult> {
    const branch = await this.branches.findOrThrow(branchId, tenantId);
    const digestEndDay = calendarDateInTimeZone(
      new Date(),
      branch.timezone || 'UTC',
    );

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        metadata: true,
        subscriptionPlan: true,
        maxBranches: true,
        maxUsers: true,
      },
    });

    if (!tenant) {
      return {
        available: false,
        reason: 'plan_not_eligible',
        snapshotVersion: WEEKLY_DIGEST_SNAPSHOT_VERSION,
        promptVersion: WEEKLY_DIGEST_PROMPT_VERSION,
        digestEndDay,
        branchId,
        detail: 'Tenant not found.',
      };
    }

    const g = this.gate(tenant, 'aiWeeklyDigest', 'weeklyDigest');
    if (!g.ok) {
      this.logger.log(
        JSON.stringify({
          msg: 'ai_insights_weekly_digest',
          tenantId,
          branchId,
          available: false,
          reason: g.reason,
        }),
      );
      return {
        available: false,
        reason: g.reason,
        snapshotVersion: WEEKLY_DIGEST_SNAPSHOT_VERSION,
        promptVersion: WEEKLY_DIGEST_PROMPT_VERSION,
        digestEndDay,
        branchId,
        detail: g.detail,
      };
    }

    const digest = await this.reports.weeklyBranchDigest(branchId, tenantId);
    const snapshot = buildWeeklyDigestInsightSnapshot(digest);

    const capKey = `${tenantId}:${branchId}:${digest.calendarWindow.endDay}:weekly`;
    const maxPerDay = this.parseCap(
      'LLM_INSIGHTS_WEEKLY_MAX_PER_BRANCH_PER_DAY',
      8,
      200,
    );
    if (!this.takeCapSlot(capKey, maxPerDay)) {
      this.logger.log(
        JSON.stringify({
          msg: 'ai_insights_weekly_digest',
          tenantId,
          branchId,
          available: false,
          reason: 'cap_exceeded',
        }),
      );
      return {
        available: false,
        reason: 'cap_exceeded',
        snapshotVersion: WEEKLY_DIGEST_SNAPSHOT_VERSION,
        promptVersion: WEEKLY_DIGEST_PROMPT_VERSION,
        digestEndDay: digest.calendarWindow.endDay,
        branchId,
        detail: `Maximum ${maxPerDay} weekly AI narrative request(s) per branch per local day.`,
      };
    }

    const result = await this.llm.completeStructured({
      taskKind: LlmTaskKind.WEEKLY_DIGEST_EXPLAIN,
      promptVersion: WEEKLY_DIGEST_PROMPT_VERSION,
      messages: [
        { role: 'system', content: WEEKLY_DIGEST_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(snapshot) },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    if (!result.ok) {
      return {
        available: false,
        reason: 'llm_unavailable',
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: WEEKLY_DIGEST_PROMPT_VERSION,
        digestEndDay: digest.calendarWindow.endDay,
        branchId,
        detail: result.detail ?? result.reason,
      };
    }

    const parsed = parseDailySummaryJson(result.text);
    if (!parsed) {
      return {
        available: false,
        reason: 'llm_parse_failed',
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: WEEKLY_DIGEST_PROMPT_VERSION,
        digestEndDay: digest.calendarWindow.endDay,
        branchId,
      };
    }

    this.logger.log(
      JSON.stringify({
        msg: 'ai_insights_weekly_digest',
        tenantId,
        branchId,
        available: true,
        digestEndDay: digest.calendarWindow.endDay,
        model: result.model ?? null,
      }),
    );

    return {
      available: true,
      snapshotVersion: snapshot.snapshotVersion,
      promptVersion: WEEKLY_DIGEST_PROMPT_VERSION,
      digestEndDay: digest.calendarWindow.endDay,
      branchId,
      body: parsed,
      model: result.model,
    };
  }

  async lowStockCommentary(
    branchId: string,
    tenantId: string,
    dateInput?: string,
  ): Promise<LowStockCommentaryResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        metadata: true,
        subscriptionPlan: true,
        maxBranches: true,
        maxUsers: true,
      },
    });

    const dailyPreview = await this.reports.daily(
      branchId,
      tenantId,
      dateInput,
    );

    if (!tenant) {
      return {
        available: false,
        reason: 'plan_not_eligible',
        snapshotVersion: LOW_STOCK_SNAPSHOT_VERSION,
        promptVersion: LOW_STOCK_PROMPT_VERSION,
        date: dailyPreview.date,
        branchId,
        detail: 'Tenant not found.',
      };
    }

    const g = this.gate(tenant, 'aiLowStockCommentary', 'lowStockCommentary');
    if (!g.ok) {
      this.logger.log(
        JSON.stringify({
          msg: 'ai_insights_low_stock',
          tenantId,
          branchId,
          available: false,
          reason: g.reason,
        }),
      );
      return {
        available: false,
        reason: g.reason,
        snapshotVersion: LOW_STOCK_SNAPSHOT_VERSION,
        promptVersion: LOW_STOCK_PROMPT_VERSION,
        date: dailyPreview.date,
        branchId,
        detail: g.detail,
      };
    }

    const branch = await this.branches.findOrThrow(branchId, tenantId);
    const snapshot = buildLowStockInsightSnapshot(dailyPreview, {
      id: branch.id,
      name: branch.name,
      timezone: branch.timezone,
    });

    if (snapshot.items.length === 0) {
      return {
        available: true,
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: LOW_STOCK_PROMPT_VERSION,
        date: dailyPreview.date,
        branchId,
        body: {
          summary:
            'No stock items are at or below the configured low threshold for this branch and day.',
        },
      };
    }

    const capKey = `${tenantId}:${branchId}:${dailyPreview.date}:low_stock`;
    const maxPerDay = this.parseCap(
      'LLM_INSIGHTS_LOW_STOCK_MAX_PER_BRANCH_PER_DAY',
      24,
      500,
    );
    if (!this.takeCapSlot(capKey, maxPerDay)) {
      return {
        available: false,
        reason: 'cap_exceeded',
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: LOW_STOCK_PROMPT_VERSION,
        date: dailyPreview.date,
        branchId,
        detail: `Maximum ${maxPerDay} low-stock AI request(s) per branch per report day.`,
      };
    }

    const result = await this.llm.completeStructured({
      taskKind: LlmTaskKind.STOCK_RISK_HINT,
      promptVersion: LOW_STOCK_PROMPT_VERSION,
      messages: [
        { role: 'system', content: LOW_STOCK_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(snapshot) },
      ],
      maxTokens: 768,
      temperature: 0.25,
    });

    if (!result.ok) {
      return {
        available: false,
        reason: 'llm_unavailable',
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: LOW_STOCK_PROMPT_VERSION,
        date: dailyPreview.date,
        branchId,
        detail: result.detail ?? result.reason,
      };
    }

    const parsed = parseDailySummaryJson(result.text);
    if (!parsed) {
      return {
        available: false,
        reason: 'llm_parse_failed',
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: LOW_STOCK_PROMPT_VERSION,
        date: dailyPreview.date,
        branchId,
      };
    }

    this.logger.log(
      JSON.stringify({
        msg: 'ai_insights_low_stock',
        tenantId,
        branchId,
        available: true,
        date: dailyPreview.date,
        model: result.model ?? null,
      }),
    );

    return {
      available: true,
      snapshotVersion: snapshot.snapshotVersion,
      promptVersion: LOW_STOCK_PROMPT_VERSION,
      date: dailyPreview.date,
      branchId,
      body: parsed,
      model: result.model,
    };
  }

  async underperformingItemsNarrative(
    branchId: string,
    tenantId: string,
  ): Promise<UnderperformersNarrativeResult> {
    const branch = await this.branches.findOrThrow(branchId, tenantId);
    const digestEndDay = calendarDateInTimeZone(
      new Date(),
      branch.timezone || 'UTC',
    );

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        metadata: true,
        subscriptionPlan: true,
        maxBranches: true,
        maxUsers: true,
      },
    });

    if (!tenant) {
      return {
        available: false,
        reason: 'plan_not_eligible',
        snapshotVersion: UNDERPERFORMERS_SNAPSHOT_VERSION,
        promptVersion: UNDERPERFORMERS_PROMPT_VERSION,
        digestEndDay,
        branchId,
        detail: 'Tenant not found.',
      };
    }

    const g = this.gate(
      tenant,
      'aiUnderperformingItems',
      'underperformingItems',
    );
    if (!g.ok) {
      this.logger.log(
        JSON.stringify({
          msg: 'ai_insights_underperformers',
          tenantId,
          branchId,
          available: false,
          reason: g.reason,
        }),
      );
      return {
        available: false,
        reason: g.reason,
        snapshotVersion: UNDERPERFORMERS_SNAPSHOT_VERSION,
        promptVersion: UNDERPERFORMERS_PROMPT_VERSION,
        digestEndDay,
        branchId,
        detail: g.detail,
      };
    }

    const data = await this.reports.underperformingMenuItemCandidates(
      branchId,
      tenantId,
    );
    const snapshot = buildUnderperformersInsightSnapshot(data, {
      id: branch.id,
      name: branch.name,
      timezone: branch.timezone,
    });

    if (data.candidates.length === 0) {
      return {
        available: true,
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: UNDERPERFORMERS_PROMPT_VERSION,
        digestEndDay: data.currentWindow.endDay,
        branchId,
        body: {
          summary:
            'No menu items matched the underperformance rules for this branch (minimum prior-period activity and largest revenue drop vs the prior 7 days).',
        },
      };
    }

    const capKey = `${tenantId}:${branchId}:${data.currentWindow.endDay}:underperf`;
    const maxPerDay = this.parseCap(
      'LLM_INSIGHTS_UNDERPERFORMERS_MAX_PER_BRANCH_PER_DAY',
      12,
      200,
    );
    if (!this.takeCapSlot(capKey, maxPerDay)) {
      return {
        available: false,
        reason: 'cap_exceeded',
        snapshotVersion: UNDERPERFORMERS_SNAPSHOT_VERSION,
        promptVersion: UNDERPERFORMERS_PROMPT_VERSION,
        digestEndDay: data.currentWindow.endDay,
        branchId,
        detail: `Maximum ${maxPerDay} underperformer AI request(s) per branch per local day.`,
      };
    }

    const result = await this.llm.completeStructured({
      taskKind: LlmTaskKind.UNDERPERFORMING_ITEMS,
      promptVersion: UNDERPERFORMERS_PROMPT_VERSION,
      messages: [
        { role: 'system', content: UNDERPERFORMERS_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(snapshot) },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    if (!result.ok) {
      return {
        available: false,
        reason: 'llm_unavailable',
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: UNDERPERFORMERS_PROMPT_VERSION,
        digestEndDay: data.currentWindow.endDay,
        branchId,
        detail: result.detail ?? result.reason,
      };
    }

    const parsed = parseDailySummaryJson(result.text);
    if (!parsed) {
      return {
        available: false,
        reason: 'llm_parse_failed',
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: UNDERPERFORMERS_PROMPT_VERSION,
        digestEndDay: data.currentWindow.endDay,
        branchId,
      };
    }

    this.logger.log(
      JSON.stringify({
        msg: 'ai_insights_underperformers',
        tenantId,
        branchId,
        available: true,
        digestEndDay: data.currentWindow.endDay,
        model: result.model ?? null,
      }),
    );

    return {
      available: true,
      snapshotVersion: snapshot.snapshotVersion,
      promptVersion: UNDERPERFORMERS_PROMPT_VERSION,
      digestEndDay: data.currentWindow.endDay,
      branchId,
      body: parsed,
      model: result.model,
    };
  }

  async branchCompareCommentary(
    branchId: string,
    tenantId: string,
    dateInput?: string,
  ): Promise<BranchCompareNarrativeResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        metadata: true,
        subscriptionPlan: true,
        maxBranches: true,
        maxUsers: true,
      },
    });

    const branch = await this.branches.findOrThrow(branchId, tenantId);
    const dateYmd =
      dateInput !== undefined && dateInput !== ''
        ? dateInput
        : calendarDateInTimeZone(new Date(), branch.timezone || 'UTC');

    if (!tenant) {
      return {
        available: false,
        reason: 'plan_not_eligible',
        snapshotVersion: BRANCH_COMPARE_SNAPSHOT_VERSION,
        promptVersion: BRANCH_COMPARE_PROMPT_VERSION,
        date: dateYmd,
        branchId,
        detail: 'Tenant not found.',
      };
    }

    const g = this.gate(tenant, 'aiBranchCompare', 'branchCompare');
    if (!g.ok) {
      this.logger.log(
        JSON.stringify({
          msg: 'ai_insights_branch_compare',
          tenantId,
          branchId,
          available: false,
          reason: g.reason,
        }),
      );
      return {
        available: false,
        reason: g.reason,
        snapshotVersion: BRANCH_COMPARE_SNAPSHOT_VERSION,
        promptVersion: BRANCH_COMPARE_PROMPT_VERSION,
        date: dateYmd,
        branchId,
        detail: g.detail,
      };
    }

    const snap = await this.reports.branchLocalDaySnapshot(tenantId, dateYmd);
    const snapshot = buildBranchCompareInsightSnapshot(snap);

    if (snap.branches.length <= 1) {
      return {
        available: true,
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: BRANCH_COMPARE_PROMPT_VERSION,
        date: snap.date,
        branchId,
        body: {
          summary:
            'Only one branch is in scope for this snapshot — compare commentary is most useful with multiple branches on the same local day.',
        },
      };
    }

    const capKey = `${tenantId}:${snap.date}:branch_compare`;
    const maxPerDay = this.parseCap(
      'LLM_INSIGHTS_BRANCH_COMPARE_MAX_PER_TENANT_PER_DAY',
      8,
      100,
    );
    if (!this.takeCapSlot(capKey, maxPerDay)) {
      return {
        available: false,
        reason: 'cap_exceeded',
        snapshotVersion: BRANCH_COMPARE_SNAPSHOT_VERSION,
        promptVersion: BRANCH_COMPARE_PROMPT_VERSION,
        date: snap.date,
        branchId,
        detail: `Maximum ${maxPerDay} branch-compare AI request(s) per tenant per calendar date.`,
      };
    }

    const result = await this.llm.completeStructured({
      taskKind: LlmTaskKind.BRANCH_COMPARE_COMMENT,
      promptVersion: BRANCH_COMPARE_PROMPT_VERSION,
      messages: [
        { role: 'system', content: BRANCH_COMPARE_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(snapshot) },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    if (!result.ok) {
      return {
        available: false,
        reason: 'llm_unavailable',
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: BRANCH_COMPARE_PROMPT_VERSION,
        date: snap.date,
        branchId,
        detail: result.detail ?? result.reason,
      };
    }

    const parsed = parseDailySummaryJson(result.text);
    if (!parsed) {
      return {
        available: false,
        reason: 'llm_parse_failed',
        snapshotVersion: snapshot.snapshotVersion,
        promptVersion: BRANCH_COMPARE_PROMPT_VERSION,
        date: snap.date,
        branchId,
      };
    }

    this.logger.log(
      JSON.stringify({
        msg: 'ai_insights_branch_compare',
        tenantId,
        branchId,
        available: true,
        date: snap.date,
        model: result.model ?? null,
      }),
    );

    return {
      available: true,
      snapshotVersion: snapshot.snapshotVersion,
      promptVersion: BRANCH_COMPARE_PROMPT_VERSION,
      date: snap.date,
      branchId,
      body: parsed,
      model: result.model,
    };
  }
}
