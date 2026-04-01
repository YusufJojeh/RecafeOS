-- CreateEnum
CREATE TYPE "StaffPushOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD');

-- CreateTable
CREATE TABLE "StaffPushOutbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "StaffPushOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPushOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffPushOutbox_status_nextAttemptAt_createdAt_idx" ON "StaffPushOutbox"("status", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "StaffPushOutbox_tenantId_createdAt_idx" ON "StaffPushOutbox"("tenantId", "createdAt");
