import { PrepStation } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class PatchMenuItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({ enum: PrepStation })
  @IsOptional()
  @IsEnum(PrepStation)
  prepStation?: PrepStation;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @ValidateIf((_, v) => v === null)
  @Allow()
  imageUrl?: string | null;
}
