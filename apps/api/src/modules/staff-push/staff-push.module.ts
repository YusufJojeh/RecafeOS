import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { BranchRealtimePushBridgeService } from './branch-realtime-push-bridge.service';
import { FcmStaffPushProviderService } from './fcm-staff-push-provider.service';
import { NoopStaffPushProviderService } from './noop-staff-push-provider.service';
import { OutboxStaffPushDispatchService } from './outbox-staff-push-dispatch.service';
import { StaffPushController } from './staff-push.controller';
import { StaffPushDispatchPort } from './staff-push-dispatch.port';
import { StaffPushOutboxWorkerService } from './staff-push-outbox-worker.service';
import { StaffPushProviderPort } from './staff-push-provider.port';
import { StaffPushService } from './staff-push.service';

function createStaffPushProvider(
  config: ConfigService,
  staffPush: StaffPushService,
): StaffPushProviderPort {
  const mode = (config.get<string>('STAFF_PUSH_PROVIDER') ?? 'noop')
    .trim()
    .toLowerCase();
  if (mode === 'fcm') {
    return new FcmStaffPushProviderService(config, staffPush);
  }
  return new NoopStaffPushProviderService();
}

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [StaffPushController],
  providers: [
    StaffPushService,
    BranchRealtimePushBridgeService,
    StaffPushOutboxWorkerService,
    {
      provide: StaffPushProviderPort,
      useFactory: createStaffPushProvider,
      inject: [ConfigService, StaffPushService],
    },
    {
      provide: StaffPushDispatchPort,
      useClass: OutboxStaffPushDispatchService,
    },
  ],
  exports: [StaffPushService, BranchRealtimePushBridgeService],
})
export class StaffPushModule {}
