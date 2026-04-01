import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PilotWeeklyReportQueryDto {
  /** ISO datetime; feedback and audit counts include rows with createdAt >= since. Defaults to 7 days ago. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  since?: string;
}
