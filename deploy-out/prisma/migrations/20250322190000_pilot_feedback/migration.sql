-- CreateEnum
CREATE TYPE "PilotFeedbackType" AS ENUM ('bug', 'onboarding_issue', 'training_issue', 'support_issue', 'product_gap', 'feature_request', 'nice_to_have');

-- CreateEnum
CREATE TYPE "PilotFeedbackSeverity" AS ENUM ('sev1', 'sev2', 'sev3', 'sev4', 'low');

-- CreateEnum
CREATE TYPE "PilotEvidenceQuality" AS ENUM ('logged_request_id', 'screenshot', 'verbal_only');

-- CreateTable
CREATE TABLE "PilotFeedbackItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "feedbackType" "PilotFeedbackType" NOT NULL,
    "severity" "PilotFeedbackSeverity" NOT NULL,
    "moduleTag" TEXT,
    "blastRadius" TEXT,
    "evidenceQuality" "PilotEvidenceQuality" NOT NULL DEFAULT 'verbal_only',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestId" TEXT,
    "externalIncidentUrl" TEXT,
    "promotedToEngineering" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByOperator" TEXT,

    CONSTRAINT "PilotFeedbackItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PilotFeedbackItem_tenantId_idx" ON "PilotFeedbackItem"("tenantId");

-- CreateIndex
CREATE INDEX "PilotFeedbackItem_tenantId_createdAt_idx" ON "PilotFeedbackItem"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "PilotFeedbackItem" ADD CONSTRAINT "PilotFeedbackItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFeedbackItem" ADD CONSTRAINT "PilotFeedbackItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
