import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class RegisterPushDeviceDto {
  @ApiProperty({ enum: ['ios', 'android', 'web'] })
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';

  @ApiProperty({
    description:
      'FCM registration token (Android / Web FCM / iOS when using Firebase SDK). Raw APNs device token is not valid for `STAFF_PUSH_PROVIDER=fcm`.',
  })
  @IsString()
  @MinLength(8)
  token!: string;
}
