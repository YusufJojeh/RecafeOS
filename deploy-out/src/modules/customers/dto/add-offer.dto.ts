import { ApiPropertyOptional } from '@nestjs/swagger';
import { OfferKind } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class AddOfferDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  /** ISO-8601 date string */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validUntil?: string;

  @ApiPropertyOptional({ enum: OfferKind })
  @IsOptional()
  @IsEnum(OfferKind)
  kind?: OfferKind;
}
