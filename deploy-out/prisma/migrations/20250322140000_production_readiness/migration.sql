-- Data cleanup before FKs (orphan references break ALTER)
UPDATE "CustomerVisit" cv
SET "orderId" = NULL
WHERE cv."orderId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o.id = cv."orderId");

UPDATE "TenantMember" tm
SET "defaultBranchId" = NULL
WHERE tm."defaultBranchId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b.id = tm."defaultBranchId");

-- TenantMember.defaultBranchId -> Branch
CREATE INDEX IF NOT EXISTS "TenantMember_defaultBranchId_idx" ON "TenantMember"("defaultBranchId");

ALTER TABLE "TenantMember"
  ADD CONSTRAINT "TenantMember_defaultBranchId_fkey"
  FOREIGN KEY ("defaultBranchId") REFERENCES "Branch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CustomerVisit.orderId -> Order
CREATE INDEX IF NOT EXISTS "CustomerVisit_orderId_idx" ON "CustomerVisit"("orderId");

ALTER TABLE "CustomerVisit"
  ADD CONSTRAINT "CustomerVisit_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- StockMovement: reconcile movements by order
CREATE INDEX IF NOT EXISTS "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- Reports: top items by menuItemId
CREATE INDEX IF NOT EXISTS "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- Active (non-terminal) orders list: branch + tenant + sort by createdAt/id
CREATE INDEX IF NOT EXISTS "Order_branchId_tenantId_open_createdAt_id_idx"
  ON "Order" ("branchId", "tenantId", "createdAt" DESC, "id" DESC)
  WHERE "status" NOT IN ('PAID'::"OrderStatus", 'CANCELLED'::"OrderStatus");

-- Single completed payment per order (current product rule)
-- Keep lexicographically greatest id if duplicates exist from legacy data
DELETE FROM "Payment" p1
USING "Payment" p2
WHERE p1."orderId" = p2."orderId"
  AND p1.status = 'COMPLETED'::"PaymentStatus"
  AND p2.status = 'COMPLETED'::"PaymentStatus"
  AND p1.id < p2.id;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_one_completed_per_order_idx"
  ON "Payment" ("orderId")
  WHERE "status" = 'COMPLETED'::"PaymentStatus";
