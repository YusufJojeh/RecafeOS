-- Scalability report blocking fix: add missing critical indexes
-- See docs/operations/scalability-report.md §4 and §11

-- OrderItem: composite index for order-detail joins and report aggregations
CREATE INDEX "OrderItem_orderId_menuItemId_idx" ON "OrderItem"("orderId", "menuItemId");

-- Payment: temporal index for daily/monthly settlement reconciliation queries
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
