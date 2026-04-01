import { Global, Module } from '@nestjs/common';
import { LeaderLockService } from './leader-lock.service';

@Global()
@Module({
  providers: [LeaderLockService],
  exports: [LeaderLockService],
})
export class LeaderLockModule {}
