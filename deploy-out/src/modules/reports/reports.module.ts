import { Module } from '@nestjs/common';
import { BranchCommonModule } from '../../common/branch/branch-common.module';
import { CommerceModule } from '../../commerce/commerce.module';
import { BranchesModule } from '../branches/branches.module';
import { ReportsController } from './reports.controller';
import { ReportsRedisCacheService } from './reports-redis-cache.service';
import { ReportsService } from './reports.service';
import { TenantReportsController } from './tenant-reports.controller';

@Module({
  imports: [BranchCommonModule, CommerceModule, BranchesModule],
  controllers: [ReportsController, TenantReportsController],
  providers: [ReportsService, ReportsRedisCacheService],
  exports: [ReportsService],
})
export class ReportsModule {}
