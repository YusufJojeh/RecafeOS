import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ResetDemoDto {
  @ApiProperty({ description: 'Branch to wipe transactional data for' })
  @IsString()
  @MinLength(1)
  branchId!: string;

  @ApiPropertyOptional({
    description:
      'Must be true when Tenant.metadata.demo is not true (acknowledges wipe on a non-demo tenant).',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  acknowledgeProductionReset?: boolean;
}
