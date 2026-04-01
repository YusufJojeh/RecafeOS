import { PrepStation } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  priceMinor!: number;

  @ApiPropertyOptional({ enum: PrepStation })
  @IsOptional()
  @IsEnum(PrepStation)
  prepStation?: PrepStation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
