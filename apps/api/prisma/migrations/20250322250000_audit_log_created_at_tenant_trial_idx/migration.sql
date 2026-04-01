-- Audit retention: index-only friendly deleteMany WHERE "createdAt" < cutoff
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- commerce.expireDueTrials: WHERE billingStatus = 'trialing' AND "trialEndsAt" < now
CREATE INDEX IF NOT EXISTS "Tenant_billingStatus_trialEndsAt_idx" ON "Tenant"("billingStatus", "trialEndsAt");

-- Drop redundant single-column index superseded by composite (billingStatus leading column)
DROP INDEX IF EXISTS "Tenant_billingStatus_idx";

-- Future-friendly: age-based retention on AnalyticsEvent (see analytics-events-retention.md)
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
