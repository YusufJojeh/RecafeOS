import { Module } from '@nestjs/common';
import { BranchMenuCacheInvalidationService } from './branch-menu-cache-invalidation.service';

@Module({
  providers: [BranchMenuCacheInvalidationService],
  exports: [BranchMenuCacheInvalidationService],
})
export class MenuCacheModule {}
