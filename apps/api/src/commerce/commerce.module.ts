import { Module } from '@nestjs/common';
import { PilotFeedbackController } from './pilot-feedback.controller';
import { TenantCommerceController } from './tenant-commerce.controller';
import { CommerceService } from './commerce.service';

@Module({
  controllers: [TenantCommerceController, PilotFeedbackController],
  providers: [CommerceService],
  exports: [CommerceService],
})
export class CommerceModule {}
