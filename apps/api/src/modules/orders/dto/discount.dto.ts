import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DiscountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  discountMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
