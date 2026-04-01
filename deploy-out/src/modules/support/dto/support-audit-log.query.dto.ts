import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SupportAuditLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  cursor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  actionPrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  branchId?: string;
}
