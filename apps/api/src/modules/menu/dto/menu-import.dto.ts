import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class MenuImportItemDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsOptional()
  @IsString()
  @IsIn(['KITCHEN', 'BAR', 'BOTH'])
  prepStation?: 'KITCHEN' | 'BAR' | 'BOTH';
}

export class MenuImportCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuImportItemDto)
  items!: MenuImportItemDto[];
}

export class MenuImportPayloadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuImportCategoryDto)
  categories!: MenuImportCategoryDto[];
}
