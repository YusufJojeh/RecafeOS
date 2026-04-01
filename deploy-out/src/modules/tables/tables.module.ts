import { Module } from '@nestjs/common';
import { BranchCommonModule } from '../../common/branch/branch-common.module';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';

@Module({
  imports: [BranchCommonModule],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
