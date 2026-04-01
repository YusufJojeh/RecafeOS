import { IsString, MinLength } from 'class-validator';

export class MergeSessionsDto {
  @IsString()
  @MinLength(1)
  targetSessionId!: string;

  @IsString()
  @MinLength(1)
  sourceSessionId!: string;
}
