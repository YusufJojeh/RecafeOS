import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { StaffPushModule } from '../modules/staff-push/staff-push.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OpsGateway } from './ops.gateway';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    StaffPushModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [OpsGateway],
  exports: [OpsGateway],
})
export class WebsocketModule {}
