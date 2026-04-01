import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OperationalHealthService } from './operational-health.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [OperationalHealthService],
  exports: [OperationalHealthService],
})
export class OperationalHealthModule {}
