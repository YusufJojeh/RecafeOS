import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateStaffInviteDto } from './dto/create-staff-invite.dto';
import { InvitesService } from './invites.service';

@ApiTags('invites')
@ApiBearerAuth()
@Controller('tenants/invites')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  @RequirePermissions('users.manage')
  list(@Req() req: Request) {
    return this.invites.listPending(req.user!.tenantId);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 86_400_000 } })
  @RequirePermissions('users.manage')
  create(@Req() req: Request, @Body() dto: CreateStaffInviteDto) {
    return this.invites.createInvite(req.user!.tenantId, req.user!.userId, dto);
  }
}
