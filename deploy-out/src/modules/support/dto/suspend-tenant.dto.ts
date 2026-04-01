import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum SuspendReasonCode {
  payment = 'payment',
  abuse = 'abuse',
  customer_request = 'customer_request',
  trial_end = 'trial_end',
  other = 'other',
}

export class SuspendTenantDto {
  @ApiProperty({ enum: SuspendReasonCode })
  @IsEnum(SuspendReasonCode)
  reasonCode!: SuspendReasonCode;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
