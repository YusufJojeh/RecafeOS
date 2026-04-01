import { ApiPropertyOptional } from '@nestjs/swagger';
import { PilotFeedbackStatus, PilotFeedbackType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class PilotFeedbackListQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ enum: PilotFeedbackType })
  @IsOptional()
  @IsEnum(PilotFeedbackType)
  feedbackType?: PilotFeedbackType;

  @ApiPropertyOptional({ enum: PilotFeedbackStatus })
  @IsOptional()
  @IsEnum(PilotFeedbackStatus)
  status?: PilotFeedbackStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  promotedToEngineering?: boolean;
}
