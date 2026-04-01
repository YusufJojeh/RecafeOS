import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Use quantity 0 to remove the line item. */
export class OrderItemQtyDto {
  @IsInt()
  @Min(0)
  quantity!: number;

  /** If set, must match current `Order.version` (from GET order) or the request fails with 409. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
