import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class AdjustStockDto {
  @IsString()
  @MinLength(1)
  stockItemId!: string;

  @IsInt()
  delta!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
