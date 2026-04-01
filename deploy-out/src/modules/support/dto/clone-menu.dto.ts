import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const MODES = ['replace_empty'] as const;

export class CloneMenuDto {
  @ApiProperty({ description: 'Branch id to copy catalog definitions from.' })
  @IsString()
  @MinLength(1)
  sourceBranchId!: string;

  @ApiProperty({ enum: MODES })
  @IsString()
  @IsIn([...MODES])
  mode!: (typeof MODES)[number];

  @ApiPropertyOptional({
    description: 'Required when using future replace_all_catalog mode.',
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeReplaceAll?: boolean;
}
