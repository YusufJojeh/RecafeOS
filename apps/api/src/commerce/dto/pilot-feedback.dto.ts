import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PilotFeedbackDto {
  @ApiProperty({ example: 'ordering' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  category!: string;

  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  @IsIn(['low', 'medium', 'high'])
  severity!: 'low' | 'medium' | 'high';

  @ApiProperty({ example: 'Discount button hard to find during rush.' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({
    description: 'Optional screen or flow (e.g. floor / kitchen)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  context?: string;
}
