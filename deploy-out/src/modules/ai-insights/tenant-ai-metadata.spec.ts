import {
  tenantAiFeatureEnabled,
  tenantAiInsightsEnabled,
} from './tenant-ai-metadata';

describe('tenantAiMetadata', () => {
  it('requires master enabled for any feature', () => {
    expect(tenantAiInsightsEnabled({})).toBe(false);
    expect(
      tenantAiFeatureEnabled(
        { aiInsights: { enabled: false } },
        'dailySummary',
      ),
    ).toBe(false);
  });

  it('legacy: only enabled flag opts into daily summary', () => {
    expect(
      tenantAiFeatureEnabled({ aiInsights: { enabled: true } }, 'dailySummary'),
    ).toBe(true);
  });

  it('explicit features map: dailySummary must be true when features object is present', () => {
    expect(
      tenantAiFeatureEnabled(
        { aiInsights: { enabled: true, features: {} } },
        'dailySummary',
      ),
    ).toBe(false);
    expect(
      tenantAiFeatureEnabled(
        { aiInsights: { enabled: true, features: { dailySummary: true } } },
        'dailySummary',
      ),
    ).toBe(true);
  });

  it('non-daily features require explicit true', () => {
    expect(
      tenantAiFeatureEnabled(
        { aiInsights: { enabled: true, features: { dailySummary: true } } },
        'weeklyDigest',
      ),
    ).toBe(false);
    expect(
      tenantAiFeatureEnabled(
        {
          aiInsights: {
            enabled: true,
            features: { dailySummary: true, weeklyDigest: true },
          },
        },
        'weeklyDigest',
      ),
    ).toBe(true);
  });
});
