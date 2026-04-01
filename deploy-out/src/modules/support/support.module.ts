import { Module } from '@nestjs/common';
import { MenuCacheModule } from '../../common/menu-cache/menu-cache.module';
import { BranchesModule } from '../branches/branches.module';
import { CommerceModule } from '../../commerce/commerce.module';
import { ProvisioningModule } from '../../provisioning/provisioning.module';
import { SupportApiKeyGuard } from './support-api-key.guard';
import { SupportController } from './support.controller';
import { SupportKeyService } from './support-key.service';
import { SupportService } from './support.service';
import { SupportUiController } from './support-ui.controller';
import { SupportUiGuard } from './support-ui.guard';

@Module({
  imports: [
    BranchesModule,
    ProvisioningModule,
    CommerceModule,
    MenuCacheModule,
  ],
  controllers: [SupportController, SupportUiController],
  providers: [
    SupportService,
    SupportKeyService,
    SupportApiKeyGuard,
    SupportUiGuard,
  ],
})
export class SupportModule {}
