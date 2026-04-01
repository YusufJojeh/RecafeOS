import type { SubscriptionPlan } from '@prisma/client';

/** Product feature flags by plan (extend as you add paid-only features). */
export type PlanFeatures = {
  qrOrdering: boolean;
  inventory: boolean;
  apiAccess: boolean;
  /** Advisory AI on daily report snapshot (see ai-insights module). */
  aiDailySummary: boolean;
  /** AI narrative for existing weekly branch digest metrics. */
  aiWeeklyDigest: boolean;
  /** Commentary on low-stock rows from daily report (thresholds are system-owned). */
  aiLowStockCommentary: boolean;
  /** Deterministic underperformer shortlist + LLM explanation. */
  aiUnderperformingItems: boolean;
  /** Reserved: promotion ideas only — ship when offers module is stable. */
  aiPromotionIdeas: boolean;
  /** Reserved: social drafts — separate consent + caps. */
  aiSocialDrafts: boolean;
  /** Reserved: multi-branch same-local-day comparison narrative. */
  aiBranchCompare: boolean;
};

export type PlanLimitRow = {
  maxBranches: number;
  maxUsers: number;
  features: PlanFeatures;
};

/**
 * Default limits per subscription tier. `scale` uses a high cap; override per tenant via `Tenant.maxBranches` / `Tenant.maxUsers`.
 */
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimitRow> = {
  trial: {
    maxBranches: 1,
    maxUsers: 5,
    features: {
      qrOrdering: true,
      inventory: true,
      apiAccess: false,
      aiDailySummary: false,
      aiWeeklyDigest: false,
      aiLowStockCommentary: false,
      aiUnderperformingItems: false,
      aiPromotionIdeas: false,
      aiSocialDrafts: false,
      aiBranchCompare: false,
    },
  },
  starter: {
    maxBranches: 1,
    maxUsers: 10,
    features: {
      qrOrdering: true,
      inventory: true,
      apiAccess: false,
      aiDailySummary: false,
      aiWeeklyDigest: false,
      aiLowStockCommentary: false,
      aiUnderperformingItems: false,
      aiPromotionIdeas: false,
      aiSocialDrafts: false,
      aiBranchCompare: false,
    },
  },
  growth: {
    maxBranches: 5,
    maxUsers: 50,
    features: {
      qrOrdering: true,
      inventory: true,
      apiAccess: true,
      aiDailySummary: true,
      aiWeeklyDigest: true,
      aiLowStockCommentary: true,
      aiUnderperformingItems: true,
      aiPromotionIdeas: false,
      aiSocialDrafts: false,
      aiBranchCompare: true,
    },
  },
  scale: {
    maxBranches: 999,
    maxUsers: 500,
    features: {
      qrOrdering: true,
      inventory: true,
      apiAccess: true,
      aiDailySummary: true,
      aiWeeklyDigest: true,
      aiLowStockCommentary: true,
      aiUnderperformingItems: true,
      aiPromotionIdeas: false,
      aiSocialDrafts: false,
      aiBranchCompare: true,
    },
  },
};
