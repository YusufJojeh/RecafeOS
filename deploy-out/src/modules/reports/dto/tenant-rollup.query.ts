import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

/** UTC calendar dates; omit both for last 7 UTC days inclusive. */
export class TenantRollupQueryDto {
  @ApiPropertyOptional({
    description: 'Range start (YYYY-MM-DD, UTC). Required if `to` is set.',
    example: '2025-03-01',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    description: 'Range end (YYYY-MM-DD, UTC). Required if `from` is set.',
    example: '2025-03-07',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
