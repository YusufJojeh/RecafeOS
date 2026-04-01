import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class AddRecipeDto {
  @IsString()
  @MinLength(1)
  menuItemId!: string;

  @IsString()
  @MinLength(1)
  stockItemId!: string;

  @IsNumber()
  @Min(0)
  qtyPerUnit!: number;
}
