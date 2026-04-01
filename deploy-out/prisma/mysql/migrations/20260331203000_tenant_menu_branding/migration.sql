-- CreateTable
CREATE TABLE `TenantMenuBranding` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `draftJson` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `publishedJson` JSON NULL,
    `logoDraftKey` VARCHAR(191) NULL,
    `logoPublishedKey` VARCHAR(191) NULL,
    `logoAnalysisJson` JSON NULL,
    `publishedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TenantMenuBranding_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TenantMenuBranding` ADD CONSTRAINT `TenantMenuBranding_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
