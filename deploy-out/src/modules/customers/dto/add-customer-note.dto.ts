import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerNoteCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddCustomerNoteDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  body!: string;

  @ApiProperty({ enum: CustomerNoteCategory })
  @IsEnum(CustomerNoteCategory)
  category!: CustomerNoteCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}
