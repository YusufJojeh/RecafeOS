import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Allowed cancel reason codes (optional; legacy cancels have null). */
export const CANCELLATION_REASON_CODES = [
  'guest_changed_mind',
  'kitchen_timeout',
  'duplicate_order',
  'out_of_stock',
  'payment_failed',
  'staff_error',
  'other',
] as const;

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cancellationReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationNote?: string;
}
