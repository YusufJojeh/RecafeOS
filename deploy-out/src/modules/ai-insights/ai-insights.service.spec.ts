import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SubscriptionPlan } from '@prisma/client';
import { CommerceService } from '../../commerce/commerce.service';
import { BranchLookupService } from '../../common/branch/branch-lookup.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { AiInsightsService } from './ai-insights.service';
import type { LlmClient } from './llm-client.interface';
import { LLM_CLIENT } from './llm.types';

describe('AiInsightsService', () => {
  const branchId = 'br1';
  const tenantId = 't1';

  async function setup(opts: {
    tenantMetadata: unknown;
    subscriptionPlan?: SubscriptionPlan;
    llm: LlmClient;
    daily: Awaited<ReturnType<ReportsService['daily']>>;
    weeklyDigest?: Awaited<ReturnType<ReportsService['weeklyBranchDigest']>>;
    underperformers?: Awaited<
      ReturnType<ReportsService['underperformingMenuItemCandidates']>
    >;
    branchCompare?: Awaited<
      ReturnType<ReportsService['branchLocalDaySnapshot']>
    >;
    capOverride?: string;
    branchTimezone?: string;
    planEnabled?: boolean;
  }) {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          metadata: opts.tenantMetadata,
          subscriptionPlan: opts.subscriptionPlan ?? SubscriptionPlan.growth,
          maxBranches: 5,
          maxUsers: 25,
        }),
      },
    };
    const branches = {
      findOrThrow: jest.fn().mockResolvedValue({
        id: branchId,
        name: 'Main',
        timezone: opts.branchTimezone ?? 'UTC',
      }),
    };
    const reports = {
      daily: jest.fn().mockResolvedValue(opts.daily),
      weeklyBranchDigest: jest.fn().mockResolvedValue(
        opts.weeklyDigest ??
          ({
            branchId,
            branchName: 'Main',
            branchTimezone: opts.branchTimezone ?? 'UTC',
            calendarWindow: {
              startDay: '2025-01-08',
              endDay: '2025-01-14',
            },
            priorPeriod: {
              netPaidSalesMinor: 0,
              orderCount: 0,
              averageOrderValueMinor: 0,
            },
            currentPeriod: {
              netPaidSalesMinor: 0,
              orderCount: 0,
              averageOrderValueMinor: 0,
            },
            delta: {
              netPaidSalesMinor: 0,
              orderCount: 0,
              averageOrderValueMinor: 0,
            },
            setup: {
              activeMenuItems: 0,
              activeCategories: 0,
              activeTables: 0,
            },
            weekdayComparison: [],
            orderTypeMix: [],
            discountTrends: {
              currentOrdersWithDiscountCount: 0,
              currentTotalDiscountMinor: 0,
              priorOrdersWithDiscountCount: 0,
              priorTotalDiscountMinor: 0,
            },
            topItems: [],
            lowStockItems: [],
          } as never),
      ),
      underperformingMenuItemCandidates: jest.fn().mockResolvedValue(
        opts.underperformers ??
          ({
            branchId,
            branchName: 'Main',
            timezone: opts.branchTimezone ?? 'UTC',
            currentWindow: {
              startDay: '2025-01-08',
              endDay: '2025-01-14',
            },
            priorWindow: {
              startDay: '2025-01-01',
              endDay: '2025-01-07',
            },
            candidates: [],
          } as never),
      ),
      branchLocalDaySnapshot: jest.fn().mockResolvedValue(
        opts.branchCompare ??
          ({
            tenantId,
            date: opts.daily.date,
            branches: [
              {
                branchId,
                branchName: 'Main',
                timezone: opts.branchTimezone ?? 'UTC',
                netPaidSalesMinor: 0,
                orderCount: 0,
                averageOrderValueMinor: 0,
                lowStockCount: 0,
              },
            ],
          } as never),
      ),
    };

    const config = {
      get: jest.fn((key: string) =>
        key === 'LLM_INSIGHTS_MAX_PER_BRANCH_PER_DAY'
          ? (opts.capOverride ?? '24')
          : undefined,
      ),
    };

    const commerce = {
      isPlanFeatureEnabled: jest.fn().mockReturnValue(opts.planEnabled ?? true),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiInsightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BranchLookupService, useValue: branches },
        { provide: ReportsService, useValue: reports },
        { provide: ConfigService, useValue: config },
        { provide: CommerceService, useValue: commerce },
        { provide: LLM_CLIENT, useValue: opts.llm },
      ],
    }).compile();

    const service = moduleRef.get(AiInsightsService);
    return { service, prisma, reports, branches };
  }

  const minimalDaily = {
    branchId,
    date: '2025-01-15',
    totalSalesMinor: 0,
    orderCount: 0,
    averageOrderValueMinor: 0,
    salesByOrderType: {},
    orderCountByOrderType: {},
    topItems: [],
    paymentsByMethod: {},
    hourlySales: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orderCount: 0,
      salesMinor: 0,
    })),
    sameWeekdayBenchmark: {
      priorSameWeekdaysSampled: 0,
      medianNetSalesMinor: 0,
      medianOrderCount: 0,
    },
    salesByCategory: [],
    cancellations: { count: 0, lostSubtotalMinor: 0, byReason: [] },
    discounts: {
      ordersWithDiscountCount: 0,
      totalDiscountMinor: 0,
      topReasons: [],
    },
    cashiers: [],
    shifts: [],
    topCustomers: [],
    visits: {
      visitsRecorded: 0,
      repeatVisitsAtBranch: 0,
      firstTimeVisitsAtBranch: 0,
    },
    stock: { lowStockItems: [] },
    flags: [],
    summary: {
      grossSalesMinor: 0,
      netSalesMinor: 0,
      totalDiscountMinor: 0,
    },
  };

  it('returns tenant_opt_in_required when metadata does not enable AI', async () => {
    const { service } = await setup({
      tenantMetadata: {},
      llm: { completeStructured: jest.fn() },
      daily: minimalDaily as never,
    });
    const r = await service.dailySummaryExplanation(branchId, tenantId);
    expect(r.available).toBe(false);
    if (!r.available) {
      expect(r.reason).toBe('tenant_opt_in_required');
    }
  });

  it('calls LLM when tenant opted in and returns parsed body', async () => {
    const completeStructured = jest.fn().mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        summary: 'Quiet day.',
        highlights: ['Low volume'],
      }),
      model: 'test',
    });
    const llm: LlmClient = {
      completeStructured,
    };
    const { service } = await setup({
      tenantMetadata: { aiInsights: { enabled: true } },
      llm,
      daily: minimalDaily as never,
    });
    const r = await service.dailySummaryExplanation(branchId, tenantId);
    expect(r.available).toBe(true);
    if (r.available) {
      expect(r.body.summary).toBe('Quiet day.');
      expect(r.body.highlights).toEqual(['Low volume']);
    }
    expect(completeStructured).toHaveBeenCalled();
  });

  it('returns llm_unavailable when client fails', async () => {
    const llm: LlmClient = {
      completeStructured: jest
        .fn()
        .mockResolvedValue({ ok: false, reason: 'unavailable' }),
    };
    const { service } = await setup({
      tenantMetadata: { aiInsights: { enabled: true } },
      llm,
      daily: minimalDaily as never,
    });
    const r = await service.dailySummaryExplanation(branchId, tenantId);
    expect(r.available).toBe(false);
    if (!r.available) {
      expect(r.reason).toBe('llm_unavailable');
    }
  });

  it('returns tenant_feature_opt_in_required when feature map disables daily summary explicitly', async () => {
    const { service } = await setup({
      tenantMetadata: { aiInsights: { enabled: true, features: {} } },
      llm: { completeStructured: jest.fn() },
      daily: minimalDaily as never,
    });
    const r = await service.dailySummaryExplanation(branchId, tenantId);
    expect(r.available).toBe(false);
    if (!r.available) {
      expect(r.reason).toBe('tenant_feature_opt_in_required');
    }
  });

  it('returns plan_not_eligible when plan feature gate is off', async () => {
    const llm = { completeStructured: jest.fn() };
    const { service } = await setup({
      tenantMetadata: { aiInsights: { enabled: true } },
      llm,
      daily: minimalDaily as never,
      planEnabled: false,
    });
    const r = await service.dailySummaryExplanation(branchId, tenantId);
    expect(r.available).toBe(false);
    if (!r.available) {
      expect(r.reason).toBe('plan_not_eligible');
    }
    expect(llm.completeStructured).not.toHaveBeenCalled();
  });

  it('returns cap_exceeded when daily cap is exhausted', async () => {
    const llm = {
      completeStructured: jest.fn().mockResolvedValue({
        ok: true,
        text: JSON.stringify({ summary: 'Quiet day.' }),
      }),
    };
    const { service } = await setup({
      tenantMetadata: { aiInsights: { enabled: true } },
      llm,
      daily: minimalDaily as never,
      capOverride: '1',
    });

    const first = await service.dailySummaryExplanation(branchId, tenantId);
    const second = await service.dailySummaryExplanation(branchId, tenantId);

    expect(first.available).toBe(true);
    expect(second.available).toBe(false);
    if (!second.available) {
      expect(second.reason).toBe('cap_exceeded');
    }
    expect(llm.completeStructured).toHaveBeenCalledTimes(1);
  });

  it('returns llm_parse_failed when daily summary payload cannot be parsed', async () => {
    const { service } = await setup({
      tenantMetadata: { aiInsights: { enabled: true } },
      llm: {
        completeStructured: jest.fn().mockResolvedValue({
          ok: true,
          text: '{"not":"the expected response"}',
        }),
      },
      daily: minimalDaily as never,
    });
    const r = await service.dailySummaryExplanation(branchId, tenantId);
    expect(r.available).toBe(false);
    if (!r.available) {
      expect(r.reason).toBe('llm_parse_failed');
    }
  });

  it('returns inline success without calling LLM when low stock list is empty', async () => {
    const llm = { completeStructured: jest.fn() };
    const { service } = await setup({
      tenantMetadata: {
        aiInsights: {
          enabled: true,
          features: { lowStockCommentary: true },
        },
      },
      llm,
      daily: minimalDaily as never,
    });
    const r = await service.lowStockCommentary(branchId, tenantId);
    expect(r.available).toBe(true);
    if (r.available) {
      expect(r.body.summary).toContain('No stock items');
    }
    expect(llm.completeStructured).not.toHaveBeenCalled();
  });

  it('returns inline success without calling LLM when branch compare has only one branch', async () => {
    const llm = { completeStructured: jest.fn() };
    const { service } = await setup({
      tenantMetadata: {
        aiInsights: {
          enabled: true,
          features: { branchCompare: true },
        },
      },
      llm,
      daily: minimalDaily as never,
    });
    const r = await service.branchCompareCommentary(branchId, tenantId);
    expect(r.available).toBe(true);
    if (r.available) {
      expect(r.body.summary).toContain('Only one branch is in scope');
    }
    expect(llm.completeStructured).not.toHaveBeenCalled();
  });

  it('returns tenant_feature_opt_in_required for weekly digest without explicit feature opt-in', async () => {
    const llm = { completeStructured: jest.fn() };
    const { service } = await setup({
      tenantMetadata: { aiInsights: { enabled: true } },
      llm,
      daily: minimalDaily as never,
    });
    const r = await service.weeklyDigestNarrative(branchId, tenantId);
    expect(r.available).toBe(false);
    if (!r.available) {
      expect(r.reason).toBe('tenant_feature_opt_in_required');
    }
    expect(llm.completeStructured).not.toHaveBeenCalled();
  });
});
