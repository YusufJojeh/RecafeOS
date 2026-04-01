import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class PilotSnapshotsListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by tenant id' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  /** ISO date `YYYY-MM-DD` — match snapshots for this week start */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekStart?: string;
}
