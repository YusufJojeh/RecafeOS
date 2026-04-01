/**
 * Tenant-level opt-in for AI insights (`Tenant.metadata`).
 * Default: disabled until `aiInsights.enabled === true`.
 *
 * Per-feature flags live under `aiInsights.features`. When `features` is omitted,
 * only legacy behavior applies: **daily summary** is allowed if `enabled` is true.
 * All other features require an explicit `features.<key> === true`.
 */
export const AiInsightsFeatureKeys = [
  'dailySummary',
  'weeklyDigest',
  'lowStockCommentary',
  'underperformingItems',
  'promotionIdeas',
  'socialDrafts',
  'branchCompare',
] as const;
export type AiInsightsFeatureKey = (typeof AiInsightsFeatureKeys)[number];

export type TenantAiInsightsMetadata = {
  enabled?: boolean;
  /**
   * Per-feature consent. If the key `features` is **absent**, legacy behavior applies:
   * only daily-summary AI was available historically — treat `dailySummary` as opted-in.
   * If `features` is present (including `{}`), each flag is explicit (`true` / omitted = off).
   */
  features?: Partial<Record<AiInsightsFeatureKey, boolean>>;
};

function readAiInsightsBlock(
  metadata: unknown,
): TenantAiInsightsMetadata | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const ai = (metadata as Record<string, unknown>).aiInsights;
  if (!ai || typeof ai !== 'object') {
    return null;
  }
  return ai as TenantAiInsightsMetadata;
}

export function tenantAiInsightsEnabled(metadata: unknown): boolean {
  const ai = readAiInsightsBlock(metadata);
  return ai?.enabled === true;
}

/**
 * Whether the tenant opted into a specific AI feature (and master switch is on).
 * - `dailySummary`: if `features` is absent, treated as allowed when `enabled` (legacy).
 * - All other keys: require `features[key] === true`.
 */
export function tenantAiFeatureEnabled(
  metadata: unknown,
  feature: AiInsightsFeatureKey,
): boolean {
  if (!tenantAiInsightsEnabled(metadata)) {
    return false;
  }
  const ai = readAiInsightsBlock(metadata);
  if (!ai) {
    return false;
  }
  const feats = ai.features;
  if (feature === 'dailySummary') {
    if (feats === undefined) {
      return true;
    }
    return feats.dailySummary === true;
  }
  return feats?.[feature] === true;
}
