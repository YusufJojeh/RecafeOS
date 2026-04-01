import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PilotEvidenceQuality,
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
  MinLength,
} from 'class-validator';

export class CreatePilotFeedbackDto {
  @ApiProperty({ enum: PilotFeedbackType })
  @IsEnum(PilotFeedbackType)
  feedbackType!: PilotFeedbackType;

  @ApiProperty({ enum: PilotFeedbackSeverity })
  @IsEnum(PilotFeedbackSeverity)
  severity!: PilotFeedbackSeverity;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ minLength: 1, maxLength: 8000 })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  branchId?: string;

  @ApiPropertyOptional({ description: 'e.g. pos, kitchen, floor' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  moduleTag?: string;

  @ApiPropertyOptional({
    description: 'single_branch | tenant_wide | unknown',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  blastRadius?: string;

  @ApiPropertyOptional({ enum: PilotEvidenceQuality })
  @IsOptional()
  @IsEnum(PilotEvidenceQuality)
  evidenceQuality?: PilotEvidenceQuality;

  @ApiPropertyOptional({ description: 'x-request-id from failed request' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  requestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  externalIncidentUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  promotedToEngineering?: boolean;

  @ApiPropertyOptional({ enum: PilotFeedbackStatus })
  @IsOptional()
  @IsEnum(PilotFeedbackStatus)
  status?: PilotFeedbackStatus;

  @ApiPropertyOptional({
    description: 'Group repeated pain points in weekly review',
  })
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
}
