import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ProvisionTenantDto {
  @ApiProperty({ example: 'Acme Bistro' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  tenantName!: string;

  @ApiProperty({ example: 'acme-bistro' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'tenantSlug must be lowercase letters, numbers, and single hyphens',
  })
  @MaxLength(64)
  tenantSlug!: string;

  @ApiProperty({ example: 'Main' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  branchName!: string;

  @ApiProperty({ example: 'main' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'branchSlug must be lowercase letters, numbers, and single hyphens',
  })
  @MaxLength(64)
  branchSlug!: string;

  @ApiProperty({ example: 'Europe/Istanbul' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  timezone!: string;

  @ApiProperty({ example: 'TRY' })
  @IsString()
  @MinLength(3)
  @MaxLength(8)
  currency!: string;

  @ApiProperty({ example: 'owner@acme.com' })
  @IsEmail()
  ownerEmail!: string;

  @ApiPropertyOptional({
    description:
      'If omitted for a new user, a random password is generated and returned once.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  ownerPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerDisplayName?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeSampleMenu = true;

  @ApiPropertyOptional({
    default: 2,
    description: 'Floor tables T1..Tn when none exist',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  tableCount = 2;

  @ApiPropertyOptional({
    description:
      'When true, sets trialing status, trial plan, and trialEndsAt.',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  trial?: boolean;

  @ApiPropertyOptional({
    description:
      'Trial length in days when trial is true (default from COMMERCE_DEFAULT_TRIAL_DAYS).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  trialDays?: number;
}
