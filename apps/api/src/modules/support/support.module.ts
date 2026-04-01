import { Module } from '@nestjs/common';
import { OperationalHealthModule } from '../../common/health/operational-health.module';
import { MenuCacheModule } from '../../common/menu-cache/menu-cache.module';
import { BranchesModule } from '../branches/branches.module';
import { CommerceModule } from '../../commerce/commerce.module';
import { ProvisioningModule } from '../../provisioning/provisioning.module';
import { SupportApiKeyGuard } from './support-api-key.guard';
import { SupportController } from './support.controller';
import { SupportDiagnosticsService } from './support-diagnostics.service';
import { SupportKeyService } from './support-key.service';
import { SupportPilotService } from './support-pilot.service';
import { SupportService } from './support.service';
import { SupportTenantAdminService } from './support-tenant-admin.service';
import { SupportTenantLookupService } from './support-tenant-lookup.service';
import { SupportUiController } from './support-ui.controller';
import { SupportUiGuard } from './support-ui.guard';

@Module({
  imports: [
    BranchesModule,
    ProvisioningModule,
    CommerceModule,
    MenuCacheModule,
    OperationalHealthModule,
  ],
  controllers: [SupportController, SupportUiController],
  providers: [
    SupportTenantLookupService,
    SupportPilotService,
    SupportTenantAdminService,
    SupportDiagnosticsService,
    SupportService,
    SupportKeyService,
    SupportApiKeyGuard,
    SupportUiGuard,
  ],
})
export class SupportModule {}
