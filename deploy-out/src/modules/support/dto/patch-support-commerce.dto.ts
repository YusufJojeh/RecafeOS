import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillingStatus, SubscriptionPlan } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class PatchSupportCommerceDto {
  @ApiPropertyOptional({ enum: SubscriptionPlan })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  subscriptionPlan?: SubscriptionPlan;

  @ApiPropertyOptional({ enum: BillingStatus })
  @IsOptional()
  @IsEnum(BillingStatus)
  billingStatus?: BillingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string | null;

  @ApiPropertyOptional({
    description: 'Override branch cap; null clears override',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxBranches?: number | null;

  @ApiPropertyOptional({
    description: 'Override staff seat cap; null clears override',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUsers?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  stripeCustomerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  stripeSubscriptionId?: string | null;
}
