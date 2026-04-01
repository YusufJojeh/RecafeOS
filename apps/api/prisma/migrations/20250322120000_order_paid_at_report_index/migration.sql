-- Index for daily sales reports: filter by branch, tenant, PAID status, and paidAt range.
CREATE INDEX "Order_branchId_tenantId_status_paidAt_idx" ON "Order"("branchId", "tenantId", "status", "paidAt");
