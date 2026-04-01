-- One completed payment row per order (matches close-bill invariant).
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_orderId_key" ON "Payment"("orderId");

-- Drop legacy non-unique index replaced by unique constraint.
DROP INDEX IF EXISTS "Payment_orderId_idx";

-- At most one OPEN TableSession per physical table (Postgres partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS "TableSession_one_open_per_floor_table_idx" ON "TableSession"("floorTableId") WHERE status = 'OPEN';
