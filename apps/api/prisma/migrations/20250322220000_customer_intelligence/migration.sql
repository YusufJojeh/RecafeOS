-- CreateEnum
CREATE TYPE "CustomerNoteCategory" AS ENUM ('GENERAL', 'PREFERENCE', 'ALLERGY', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "OfferKind" AS ENUM ('MANUAL', 'REPEAT_WINBACK');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "kind" "OfferKind" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "redeemedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "branchId" TEXT,
    "category" "CustomerNoteCategory" NOT NULL DEFAULT 'GENERAL',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerNote_customerId_createdAt_idx" ON "CustomerNote"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permission: customer lookup (read-only)
INSERT INTO "Permission" ("id", "code")
SELECT gen_random_uuid()::text, 'customers.view'
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "code" = 'customers.view');

-- Grant customers.view to roles that already have customers.manage (owner/manager templates)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
INNER JOIN "Permission" pm ON pm."code" = 'customers.manage'
INNER JOIN "Permission" p ON p."code" = 'customers.view'
WHERE r."tenantId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "RolePermission" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = pm."id")
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp2
    WHERE rp2."roleId" = r."id" AND rp2."permissionId" = p."id"
  );

-- Cashier: customers.view only (drop customers.manage for lookup-without-edit)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
INNER JOIN "Permission" p ON p."code" = 'customers.view'
WHERE r."tenantId" IS NOT NULL
  AND r.name = 'cashier'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp2
    WHERE rp2."roleId" = r."id" AND rp2."permissionId" = p."id"
  );

DELETE FROM "RolePermission" rp
USING "Role" r, "Permission" pm
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = pm."id"
  AND pm."code" = 'customers.manage'
  AND r."tenantId" IS NOT NULL
  AND r.name = 'cashier';
