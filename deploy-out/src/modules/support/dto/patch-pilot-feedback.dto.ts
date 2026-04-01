import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PilotFeedbackSeverity,
  PilotFeedbackStatus,
  PilotFeedbackType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PatchPilotFeedbackDto {
  @ApiPropertyOptional({ enum: PilotFeedbackType })
  @IsOptional()
  @IsEnum(PilotFeedbackType)
  feedbackType?: PilotFeedbackType;

  @ApiPropertyOptional({ enum: PilotFeedbackSeverity })
  @IsOptional()
  @IsEnum(PilotFeedbackSeverity)
  severity?: PilotFeedbackSeverity;

  @ApiPropertyOptional({ enum: PilotFeedbackStatus })
  @IsOptional()
  @IsEnum(PilotFeedbackStatus)
  status?: PilotFeedbackStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  themeKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  businessCritical?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  triageNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  promotedToEngineering?: boolean;
}
