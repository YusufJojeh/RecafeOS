import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Tenant } from '@prisma/client';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtAccessPayload } from '../../common/types/jwt-payload';
import { StaffAuthCacheService } from '../../common/auth-cache/staff-auth-cache.service';
import { CommerceService } from '../../commerce/commerce.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly commerce: CommerceService,
    private readonly authCache: StaffAuthCacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    let permissions = await this.authCache.getPermissions(
      user.id,
      payload.tenantId,
    );
    if (permissions === null) {
      const loaded = await this.auth.memberPermissionCodes(
        user.id,
        payload.tenantId,
      );
      if (loaded === null) {
        throw new UnauthorizedException();
      }
      permissions = loaded;
      await this.authCache.setPermissions(user.id, payload.tenantId, loaded);
    }

    let tenantSlice = await this.authCache.getTenantStaff(payload.tenantId);
    if (tenantSlice === null) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        select: {
          billingStatus: true,
          trialEndsAt: true,
          metadata: true,
        },
      });
      if (!tenant) {
        throw new UnauthorizedException();
      }
      tenantSlice = {
        billingStatus: tenant.billingStatus,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
        metadata: tenant.metadata,
      };
      await this.authCache.setTenantStaff(payload.tenantId, tenantSlice);
    }
    this.commerce.assertStaffTenantAccess({
      billingStatus: tenantSlice.billingStatus as Tenant['billingStatus'],
      trialEndsAt: tenantSlice.trialEndsAt
        ? new Date(tenantSlice.trialEndsAt)
        : null,
      metadata: tenantSlice.metadata as Tenant['metadata'],
    });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      tenantId: payload.tenantId,
      permissions,
    };
  }
}
