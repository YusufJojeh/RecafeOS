import { FloorTableStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class PatchTableDto {
  @ApiPropertyOptional({ enum: FloorTableStatus })
  @IsOptional()
  @IsEnum(FloorTableStatus)
  status?: FloorTableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;
}
