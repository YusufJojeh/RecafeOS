import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LogoAnalysisService } from './logo-analysis.service';
import { MenuBrandingController } from './menu-branding.controller';
import { MenuBrandingService } from './menu-branding.service';
import { PublicTenantAssetsController } from './public-tenant-assets.controller';
import { TenantLogoStorageService } from './tenant-logo-storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [MenuBrandingController, PublicTenantAssetsController],
  providers: [
    MenuBrandingService,
    TenantLogoStorageService,
    LogoAnalysisService,
  ],
  exports: [MenuBrandingService],
})
export class MenuBrandingModule {}
