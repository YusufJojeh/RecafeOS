import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SearchCustomersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
