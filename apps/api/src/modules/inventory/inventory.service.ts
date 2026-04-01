import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CommerceService } from '../../commerce/commerce.service';
import { BranchLookupService } from '../../common/branch/branch-lookup.service';
import { whereUnderBranchTenant } from '../../common/persistence/branch-scope';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branches: BranchLookupService,
    private readonly commerce: CommerceService,
  ) {}

  async list(branchId: string, tenantId: string) {
    await this.commerce.assertPlanFeatureForTenant(tenantId, 'inventory');
    return this.prisma.stockItem.findMany({
      where: whereUnderBranchTenant(branchId, tenantId),
      orderBy: { name: 'asc' },
    });
  }

  async adjust(
    branchId: string,
    tenantId: string,
    userId: string,
    body: { stockItemId: string; delta: number; note?: string },
  ) {
    await this.commerce.assertPlanFeatureForTenant(tenantId, 'inventory');
    const item = await this.prisma.stockItem.findFirst({
      where: {
        id: body.stockItemId,
        ...whereUnderBranchTenant(branchId, tenantId),
      },
    });
    if (!item) {
      throw new NotFoundException();
    }
    const res = await this.prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          branchId,
          stockItemId: item.id,
          type: 'ADJUSTMENT',
          delta: new Prisma.Decimal(body.delta),
          note: body.note,
        },
      });
      return tx.stockItem.update({
        where: { id: item.id },
        data: { quantity: { increment: body.delta } },
      });
    });
    await this.audit.log({
      tenantId,
      branchId,
      actorId: userId,
      action: 'stock.adjust',
      entity: 'StockItem',
      entityId: item.id,
      metadata: { delta: body.delta },
    });
    return res;
  }

  async addRecipe(
    branchId: string,
    tenantId: string,
    body: { menuItemId: string; stockItemId: string; qtyPerUnit: number },
  ) {
    await this.commerce.assertPlanFeatureForTenant(tenantId, 'inventory');
    await this.branches.findOrThrow(branchId, tenantId);
    const [menuItem, stockItem] = await Promise.all([
      this.prisma.menuItem.findFirst({
        where: {
          id: body.menuItemId,
          ...whereUnderBranchTenant(branchId, tenantId),
        },
      }),
      this.prisma.stockItem.findFirst({
        where: {
          id: body.stockItemId,
          ...whereUnderBranchTenant(branchId, tenantId),
        },
      }),
    ]);
    if (!menuItem || !stockItem) {
      throw new BadRequestException(
        'menuItemId and stockItemId must exist on this branch for this tenant',
      );
    }
    return this.prisma.itemRecipe.create({
      data: {
        menuItemId: menuItem.id,
        stockItemId: stockItem.id,
        qtyPerUnit: body.qtyPerUnit,
      },
    });
  }
}
