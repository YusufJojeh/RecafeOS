import { Module } from '@nestjs/common';
import { BranchCommonModule } from '../../common/branch/branch-common.module';
import { MenuCacheModule } from '../../common/menu-cache/menu-cache.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [BranchCommonModule, MenuCacheModule],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
