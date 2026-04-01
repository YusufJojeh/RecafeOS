import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password, dto.tenantSlug);
  }

  @Post('accept-invite')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.auth.acceptInvite(dto.token, dto.password, dto.displayName);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@Req() req: Request) {
    const u = req.user as Express.User & {
      userId: string;
      tenantId: string;
      permissions: string[];
    };
    const branch = await this.auth.getStaffSessionBranchContext(
      u.userId,
      u.tenantId,
    );
    return {
      userId: u.userId,
      email: u.email,
      displayName: u.displayName,
      tenantId: u.tenantId,
      permissions: u.permissions,
      defaultBranchId: branch.defaultBranchId,
      branchAccessScope: branch.branchAccessScope,
    };
  }
}
