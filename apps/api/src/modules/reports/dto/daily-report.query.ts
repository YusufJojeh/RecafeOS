import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Omit or pass YYYY-MM-DD or ISO-8601; service normalizes to calendar date. */
export class DailyReportQueryDto {
  @ApiPropertyOptional({
    description:
      'Calendar day (YYYY-MM-DD) or ISO instant; defaults to today in branch timezone',
  })
  @IsOptional()
  @IsString()
  date?: string;
}
