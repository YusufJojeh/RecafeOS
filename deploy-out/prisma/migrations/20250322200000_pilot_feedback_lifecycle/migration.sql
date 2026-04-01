-- CreateEnum
CREATE TYPE "PilotFeedbackStatus" AS ENUM ('open', 'triaged', 'resolved', 'closed');

-- AlterTable
ALTER TABLE "PilotFeedbackItem" ADD COLUMN "status" "PilotFeedbackStatus" NOT NULL DEFAULT 'open';
ALTER TABLE "PilotFeedbackItem" ADD COLUMN "themeKey" TEXT;
ALTER TABLE "PilotFeedbackItem" ADD COLUMN "businessCritical" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PilotFeedbackItem" ADD COLUMN "triageNotes" TEXT;

-- CreateIndex
CREATE INDEX "PilotFeedbackItem_tenantId_status_idx" ON "PilotFeedbackItem"("tenantId", "status");

-- CreateTable
CREATE TABLE "PilotWeeklySnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "pilotHealth" TEXT,
    "jsonPayload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotWeeklySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PilotWeeklySnapshot_tenantId_weekStart_key" ON "PilotWeeklySnapshot"("tenantId", "weekStart");

-- CreateIndex
CREATE INDEX "PilotWeeklySnapshot_weekStart_idx" ON "PilotWeeklySnapshot"("weekStart");

-- AddForeignKey
ALTER TABLE "PilotWeeklySnapshot" ADD CONSTRAINT "PilotWeeklySnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
