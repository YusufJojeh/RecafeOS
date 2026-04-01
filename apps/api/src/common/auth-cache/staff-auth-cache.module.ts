import { Global, Module } from '@nestjs/common';
import { StaffAuthCacheService } from './staff-auth-cache.service';

@Global()
@Module({
  providers: [StaffAuthCacheService],
  exports: [StaffAuthCacheService],
})
export class StaffAuthCacheModule {}
