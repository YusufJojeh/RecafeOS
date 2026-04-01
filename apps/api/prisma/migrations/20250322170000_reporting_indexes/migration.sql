-- Reporting: cancellation date-range scans, visit windows, cashier grouping
CREATE INDEX IF NOT EXISTS "Order_branchId_tenantId_status_cancelledAt_idx"
  ON "Order" ("branchId", "tenantId", status, "cancelledAt");

CREATE INDEX IF NOT EXISTS "CustomerVisit_branchId_visitedAt_idx"
  ON "CustomerVisit" ("branchId", "visitedAt");

CREATE INDEX IF NOT EXISTS "Payment_recordedByUserId_idx"
  ON "Payment" ("recordedByUserId");
