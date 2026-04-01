import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class RegisterPushDeviceDto {
  @ApiProperty({ enum: ['ios', 'android', 'web'] })
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';

  @ApiProperty({ description: 'FCM / APNs / Web Push endpoint or token string' })
  @IsString()
  @MinLength(8)
  token!: string;
}
