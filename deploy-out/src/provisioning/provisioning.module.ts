import { Module } from '@nestjs/common';
import { MenuCacheModule } from '../common/menu-cache/menu-cache.module';
import { CommerceModule } from '../commerce/commerce.module';
import { ProvisioningService } from './provisioning.service';

@Module({
  imports: [CommerceModule, MenuCacheModule],
  providers: [ProvisioningService],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
