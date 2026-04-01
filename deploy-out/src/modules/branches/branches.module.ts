import { Module } from '@nestjs/common';
import { CommerceModule } from '../../commerce/commerce.module';
import { AuditModule } from '../audit/audit.module';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  imports: [CommerceModule, AuditModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
