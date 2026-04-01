import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { StaffPushService } from './staff-push.service';

/**
 * Persists device tokens for future FCM/APNs/Web delivery. No notification worker yet —
 * see docs/operations/notifications-readiness.md.
 */
@ApiTags('push-devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants/push-devices')
export class StaffPushController {
  constructor(private readonly push: StaffPushService) {}

  @Post()
  @HttpCode(200)
  register(@Req() req: Request, @Body() body: RegisterPushDeviceDto) {
    const u = req.user as Express.User & { userId: string; tenantId: string };
    return this.push.register(u.userId, u.tenantId, body.platform, body.token.trim());
  }

  @Get()
  list(@Req() req: Request) {
    const u = req.user as Express.User & { userId: string; tenantId: string };
    return this.push.listForUser(u.userId, u.tenantId);
  }
}
