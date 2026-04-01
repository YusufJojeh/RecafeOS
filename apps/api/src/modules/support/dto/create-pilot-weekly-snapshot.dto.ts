import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePilotWeeklySnapshotDto {
  /** ISO date `YYYY-MM-DD` (week start, UTC). */
  @ApiProperty({ example: '2025-03-17' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekStart!: string;

  @ApiPropertyOptional({ description: 'green | yellow | red' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  pilotHealth?: string;

  @ApiPropertyOptional({
    description: 'Arbitrary JSON blob (orders snapshot, notes, etc.)',
  })
  @IsOptional()
  @IsObject()
  jsonPayload?: Record<string, unknown>;
}
