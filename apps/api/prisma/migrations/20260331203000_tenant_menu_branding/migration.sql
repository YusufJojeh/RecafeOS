-- CreateTable
CREATE TABLE "TenantMenuBranding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "draftJson" JSONB NOT NULL DEFAULT '{}',
    "publishedJson" JSONB,
    "logoDraftKey" TEXT,
    "logoPublishedKey" TEXT,
    "logoAnalysisJson" JSONB,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantMenuBranding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantMenuBranding_tenantId_key" ON "TenantMenuBranding"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantMenuBranding" ADD CONSTRAINT "TenantMenuBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
