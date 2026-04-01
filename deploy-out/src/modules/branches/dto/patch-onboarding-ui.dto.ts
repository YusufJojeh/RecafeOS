import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Only non-blocking onboarding step ids may be snoozed or dismissed. */
const RECOMMENDED_STEP_IDS = ['session'] as const;

export class PatchOnboardingUiDto {
  @ApiProperty({ enum: RECOMMENDED_STEP_IDS })
  @IsString()
  @IsIn([...RECOMMENDED_STEP_IDS])
  stepId!: (typeof RECOMMENDED_STEP_IDS)[number];

  @ApiPropertyOptional({
    description: 'Snooze nudges for this recommended step (1–30 days).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  snoozeDays?: number;

  @ApiPropertyOptional({
    description: 'Hide from progress until completed or reset.',
  })
  @IsOptional()
  @IsBoolean()
  dismiss?: boolean;

  @ApiPropertyOptional({ description: 'Clear snooze/dismiss for this step.' })
  @IsOptional()
  @IsBoolean()
  clear?: boolean;
}
