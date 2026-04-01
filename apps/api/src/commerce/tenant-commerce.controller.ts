import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../modules/auth/jwt-auth.guard';
import { CommerceService } from './commerce.service';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantCommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('commerce')
  getCommerce(@Req() req: Request) {
    const tenantId = req.user!.tenantId;
    return this.commerce.getCommerceReadModel(tenantId);
  }
}
