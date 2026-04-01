import { Module } from '@nestjs/common';
import { BranchLookupService } from './branch-lookup.service';

@Module({
  providers: [BranchLookupService],
  exports: [BranchLookupService],
})
export class BranchCommonModule {}
