import { PrepTicketStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class PatchTicketDto {
  @IsEnum(PrepTicketStatus)
  status!: PrepTicketStatus;
}
