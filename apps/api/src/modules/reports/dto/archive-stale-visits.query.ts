import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Deletes visit rows older than this many full calendar years (UTC), then recomputes `Customer.visitCount`. */
export class ArchiveStaleVisitsQueryDto {
  @ApiPropertyOptional({
    description: 'Retention window in years (default 7, min 1, max 30)',
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  years?: number;
}
