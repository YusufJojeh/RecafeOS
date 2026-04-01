import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AddOrderItemDto {
  @IsString()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  modifierOptionIds?: string[];

  /** If set, must match current `Order.version` (from GET order) or the request fails with 409. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
