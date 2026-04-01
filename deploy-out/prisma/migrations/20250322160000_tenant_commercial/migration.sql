-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('trial', 'starter', 'growth', 'scale');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'suspended');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'starter',
ADD COLUMN     "billingStatus" "BillingStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "maxBranches" INTEGER,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "Tenant_billingStatus_idx" ON "Tenant"("billingStatus");

-- CreateIndex
CREATE INDEX "Tenant_subscriptionPlan_idx" ON "Tenant"("subscriptionPlan");

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_tenantId_createdAt_idx" ON "AnalyticsEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");
