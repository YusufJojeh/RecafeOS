-- Stale PROCESSING reclaim: record when a row is claimed so crashed workers can release it.
ALTER TABLE "StaffPushOutbox" ADD COLUMN "processingStartedAt" TIMESTAMP(3);

CREATE INDEX "StaffPushOutbox_status_processingStartedAt_idx" ON "StaffPushOutbox"("status", "processingStartedAt");
