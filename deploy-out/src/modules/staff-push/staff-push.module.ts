import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StaffPushController } from './staff-push.controller';
import { StaffPushService } from './staff-push.service';

@Module({
  imports: [PrismaModule],
  controllers: [StaffPushController],
  providers: [StaffPushService],
})
export class StaffPushModule {}
