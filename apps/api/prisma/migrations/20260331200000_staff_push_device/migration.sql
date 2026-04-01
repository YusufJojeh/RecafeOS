-- CreateTable
CREATE TABLE "StaffPushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPushDevice_userId_tenantId_platform_token_key" ON "StaffPushDevice"("userId", "tenantId", "platform", "token");

-- CreateIndex
CREATE INDEX "StaffPushDevice_tenantId_idx" ON "StaffPushDevice"("tenantId");

-- CreateIndex
CREATE INDEX "StaffPushDevice_userId_tenantId_idx" ON "StaffPushDevice"("userId", "tenantId");

-- AddForeignKey
ALTER TABLE "StaffPushDevice" ADD CONSTRAINT "StaffPushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPushDevice" ADD CONSTRAINT "StaffPushDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
