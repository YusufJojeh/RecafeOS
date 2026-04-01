import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const ROLES = ['manager', 'cashier', 'kitchen'] as const;

export class CreateStaffInviteDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ROLES, default: 'cashier' })
  @IsOptional()
  @IsString()
  @IsIn([...ROLES])
  role?: (typeof ROLES)[number];

  @ApiPropertyOptional({
    description: 'Optional default branch for the member after accept.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  defaultBranchId?: string;
}
