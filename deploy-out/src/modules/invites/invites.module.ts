import { Module } from '@nestjs/common';
import { CommerceModule } from '../../commerce/commerce.module';
import { AuditModule } from '../audit/audit.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [CommerceModule, AuditModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
