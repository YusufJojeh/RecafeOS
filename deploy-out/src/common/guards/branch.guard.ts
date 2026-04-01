import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthCacheService } from '../auth-cache/staff-auth-cache.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Ensures X-Branch-Id is present, matches :branchId when present, and the branch
 * belongs to the authenticated user's tenant.
 *
 * **Semantics:** There is no per-user branch allow-list in the data model today
 * (`TenantMember.defaultBranchId` is UI default only). Any tenant member with
 * the relevant permission codes may operate on any branch of that tenant once
 * they pass `PermissionsGuard`. Tightening to assigned branches would require
 * schema + migration + invite flows.
 */
@Injectable()
export class BranchGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authCache: StaffAuthCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user;
    if (!user?.tenantId) {
      throw new ForbiddenException();
    }
    const branchId = req.headers['x-branch-id'] as string | undefined;
    if (!branchId) {
      throw new BadRequestException('X-Branch-Id header is required');
    }
    const routeBranchId = (req.params as Record<string, string | undefined>)[
      'branchId'
    ];
    if (routeBranchId !== undefined && routeBranchId !== branchId) {
      throw new ForbiddenException(
        'X-Branch-Id must match the branch in the URL',
      );
    }
    const cached = await this.authCache.getBranchInTenant(
      user.tenantId,
      branchId,
    );
    if (cached === false) {
      throw new ForbiddenException('Invalid branch');
    }
    if (cached === null) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId: user.tenantId },
        select: { id: true },
      });
      const ok = branch != null;
      await this.authCache.setBranchInTenant(user.tenantId, branchId, ok);
      if (!ok) {
        throw new ForbiddenException('Invalid branch');
      }
    }
    req.branchId = branchId;
    return true;
  }
}
