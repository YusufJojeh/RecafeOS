import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PatchTicketDto } from './dto/patch-ticket.dto';
import { KitchenService } from './kitchen.service';

@ApiTags('kitchen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
@Controller('branches/:branchId/kitchen')
export class KitchenController {
  constructor(private readonly kitchen: KitchenService) {}

  @Get('tickets')
  @RequirePermissions('kitchen.view')
  listKitchen(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Query('station') station?: string,
  ) {
    const tenantId = req.user!.tenantId;
    const s = station === 'BAR' ? 'BAR' : 'KITCHEN';
    return this.kitchen.listTickets(branchId, tenantId, s);
  }

  @Patch('tickets/:ticketId')
  @RequirePermissions('kitchen.view')
  updateKitchen(
    @Param('branchId') branchId: string,
    @Param('ticketId') ticketId: string,
    @Req() req: Request,
    @Body() body: PatchTicketDto,
  ) {
    return this.kitchen.updateTicket(
      branchId,
      req.user!.tenantId,
      ticketId,
      body,
    );
  }
}

@ApiTags('bar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
@Controller('branches/:branchId/bar')
export class BarController {
  constructor(private readonly kitchen: KitchenService) {}

  @Get('tickets')
  @RequirePermissions('bar.view')
  listBar(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.kitchen.listTickets(branchId, req.user!.tenantId, 'BAR');
  }

  @Patch('tickets/:ticketId')
  @RequirePermissions('bar.view')
  updateBar(
    @Param('branchId') branchId: string,
    @Param('ticketId') ticketId: string,
    @Req() req: Request,
    @Body() body: PatchTicketDto,
  ) {
    return this.kitchen.updateTicket(
      branchId,
      req.user!.tenantId,
      ticketId,
      body,
    );
  }
}
