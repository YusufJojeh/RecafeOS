import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PublicOrderLineDto {
  @IsString()
  @MinLength(8)
  @MaxLength(36)
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'menuItemId must be alphanumeric',
  })
  menuItemId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(36, { each: true })
  modifierOptionIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PublicCreateOrderDto {
  @ApiProperty({ type: [PublicOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => PublicOrderLineDto)
  items!: PublicOrderLineDto[];
}
