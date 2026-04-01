import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tableSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceNote?: string;
}
