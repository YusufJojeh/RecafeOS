import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../modules/auth/jwt-auth.guard';
import { CommerceService } from './commerce.service';
import { PilotFeedbackDto } from './dto/pilot-feedback.dto';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class PilotFeedbackController {
  constructor(private readonly commerce: CommerceService) {}

  @Post('pilot-feedback')
  @HttpCode(200)
  async submit(@Req() req: Request, @Body() dto: PilotFeedbackDto) {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    await this.commerce.recordAnalyticsEvent('pilot.feedback', tenantId, {
      userId,
      category: dto.category,
      severity: dto.severity,
      message: dto.message,
      context: dto.context ?? null,
      submittedAt: new Date().toISOString(),
    });
    return { ok: true };
  }
}
