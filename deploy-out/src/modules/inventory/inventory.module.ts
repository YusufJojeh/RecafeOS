import { Module } from '@nestjs/common';
import { CommerceModule } from '../../commerce/commerce.module';
import { BranchCommonModule } from '../../common/branch/branch-common.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [BranchCommonModule, CommerceModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
