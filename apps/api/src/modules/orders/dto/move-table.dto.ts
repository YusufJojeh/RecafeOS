import { IsString } from 'class-validator';

export class MoveTableDto {
  @IsString()
  tableSessionId!: string;
}
