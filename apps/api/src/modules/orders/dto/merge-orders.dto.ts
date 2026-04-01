import { IsString } from 'class-validator';

export class MergeOrdersDto {
  @IsString()
  targetOrderId!: string;

  @IsString()
  sourceOrderId!: string;
}
