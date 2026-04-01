import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class GoLiveAckDto {
  @ApiProperty({
    description:
      'Must be true to acknowledge; server rejects if blocking steps remain.',
  })
  @IsBoolean()
  confirm!: boolean;
}
