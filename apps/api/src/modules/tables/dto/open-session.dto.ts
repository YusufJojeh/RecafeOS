import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class OpenSessionDto {
  @IsString()
  @MinLength(1)
  floorTableId!: string;

  @IsInt()
  @Min(1)
  guestCount!: number;
}
