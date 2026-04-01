import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Staff roles support can assign (not owner — use provision flow for primary owner). */
export const SUPPORT_MEMBER_ROLE_NAMES = [
  'manager',
  'cashier',
  'kitchen',
] as const;

export type SupportMemberRoleName = (typeof SUPPORT_MEMBER_ROLE_NAMES)[number];

export class CreateSupportTenantMemberDto {
  @ApiProperty({ example: 'staff@venue.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Floor lead' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({
    description:
      'If omitted for a new user, a random password is generated and returned once.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({
    enum: SUPPORT_MEMBER_ROLE_NAMES,
    default: 'cashier',
    description: 'Defaults to cashier when omitted.',
  })
  @IsOptional()
  @IsIn(SUPPORT_MEMBER_ROLE_NAMES)
  role?: SupportMemberRoleName;

  @ApiPropertyOptional({
    description:
      'Optional default branch for this member (must belong to tenant).',
  })
  @IsOptional()
  @IsString()
  defaultBranchId?: string;
}
