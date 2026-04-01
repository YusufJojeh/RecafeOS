import { Global, Module } from '@nestjs/common';
import { AuditRetentionService } from './audit-retention.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  providers: [AuditService, AuditRetentionService],
  exports: [AuditService],
})
export class AuditModule {}
