import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BranchRealtimeEvent } from '@restocafe/types';
import { CommerceService } from '../../commerce/commerce.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OpsGateway } from '../../websocket/ops.gateway';
import { MenuBrandingService } from '../menu-branding/menu-branding.service';

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ops: OpsGateway,
    private readonly commerce: CommerceService,
    private readonly menuBranding: MenuBrandingService,
  ) {}

  async menuBySlug(tenantSlug: string, branchSlug: string) {
    const branch = await this.resolveBranchBySlug(tenantSlug, branchSlug);
    return this.buildMenuPayload(
      branch.id,
      branch.name,
      branch.slug,
      branch.tenantId,
      branch.tenant.slug,
    );
  }

  async menuForSession(tenantSlug: string, branchSlug: string, token: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { publicToken: token },
      include: {
        branch: {
          include: {
            tenant: true,
          },
        },
      },
    });
    if (!session || session.status !== 'OPEN') {
      throw new NotFoundException();
    }
    this.commerce.assertPublicTenantAccess(session.branch.tenant);
    if (
      session.branch.slug !== branchSlug ||
      session.branch.tenant.slug !== tenantSlug
    ) {
      throw new NotFoundException();
    }
    return this.buildMenuPayload(
      session.branch.id,
      session.branch.name,
      session.branch.slug,
      session.branch.tenantId,
      session.branch.tenant.slug,
    );
  }

  private async resolveBranchBySlug(tenantSlug: string, branchSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new NotFoundException();
    }
    this.commerce.assertPublicTenantAccess(tenant);
    const branch = await this.prisma.branch.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: branchSlug } },
      include: { tenant: { select: { id: true, slug: true } } },
    });
    if (!branch) {
      throw new NotFoundException();
    }
    return branch;
  }

  private async buildMenuPayload(
    branchId: string,
    branchName: string,
    branchSlug: string,
    tenantId: string,
    tenantSlug: string,
  ) {
    const categories = await this.prisma.menuCategory.findMany({
      where: { branchId },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { visible: true, available: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            modifierGroups: {
              include: {
                modifierGroup: {
                  include: { options: { orderBy: { sortOrder: 'asc' } } },
                },
              },
            },
          },
        },
      },
    });
    const branding =
      await this.menuBranding.getPublishedForPublicMenu(tenantId, tenantSlug);
    return {
      branch: { id: branchId, name: branchName, slug: branchSlug },
      tenant: { slug: tenantSlug },
      branding,
      categories,
    };
  }

  async callWaiter(token: string, body: { message?: string }) {
    const session = await this.prisma.tableSession.findUnique({
      where: { publicToken: token },
      include: { branch: { include: { tenant: true } } },
    });
    if (!session || session.status !== 'OPEN') {
      throw new NotFoundException();
    }
    this.commerce.assertPublicTenantAccess(session.branch.tenant);
    const settings = session.branch.settings as Record<string, unknown> | null;
    if (settings && settings['qrCallWaiterEnabled'] === false) {
      throw new BadRequestException('Waiter call disabled');
    }
    const call = await this.prisma.waiterCall.create({
      data: {
        branchId: session.branchId,
        tableSessionId: session.id,
        message: body.message,
      },
    });
    this.ops.emitBranchEvent(
      session.branchId,
      BranchRealtimeEvent.WAITER_CALL,
      {
        callId: call.id,
        tableSessionId: session.id,
      },
    );
    return { ok: true };
  }
}
