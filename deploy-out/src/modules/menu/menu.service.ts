import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrepStation } from '@prisma/client';
import { BranchLookupService } from '../../common/branch/branch-lookup.service';
import { BranchMenuCacheInvalidationService } from '../../common/menu-cache/branch-menu-cache-invalidation.service';
import {
  whereBranchInTenant,
  whereUnderBranchTenant,
} from '../../common/persistence/branch-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { MenuImportPayloadDto } from './dto/menu-import.dto';

/** Capped self-serve import (see docs/growth/RETENTION_BACKLOG.md). */
export const MENU_IMPORT_MAX_ITEMS_PER_APPLY = 200;

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchLookupService,
    private readonly audit: AuditService,
    private readonly branchMenuCache: BranchMenuCacheInvalidationService,
  ) {}

  categories(branchId: string, tenantId: string) {
    return this.prisma.menuCategory.findMany({
      where: { branch: whereBranchInTenant(branchId, tenantId) },
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createCategory(
    branchId: string,
    tenantId: string,
    body: { name: string; sortOrder?: number },
  ) {
    await this.branches.findOrThrow(branchId, tenantId);
    const row = await this.prisma.menuCategory.create({
      data: { branchId, name: body.name, sortOrder: body.sortOrder ?? 0 },
    });
    await this.branchMenuCache.invalidateBranch(branchId);
    return row;
  }

  async createItem(
    branchId: string,
    tenantId: string,
    body: {
      categoryId: string;
      name: string;
      description?: string;
      priceMinor: number;
      prepStation?: 'KITCHEN' | 'BAR' | 'BOTH';
      imageUrl?: string;
    },
  ) {
    await this.branches.findOrThrow(branchId, tenantId);
    const row = await this.prisma.menuItem.create({
      data: {
        branchId,
        categoryId: body.categoryId,
        name: body.name,
        description: body.description,
        priceMinor: body.priceMinor,
        prepStation: body.prepStation ?? 'KITCHEN',
        imageUrl: body.imageUrl,
      },
    });
    await this.branchMenuCache.invalidateBranch(branchId);
    return row;
  }

  async patchItem(
    branchId: string,
    tenantId: string,
    itemId: string,
    body: Partial<{
      name: string;
      description: string;
      priceMinor: number;
      visible: boolean;
      available: boolean;
      prepStation: 'KITCHEN' | 'BAR' | 'BOTH';
      imageUrl: string | null;
    }>,
  ) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, ...whereUnderBranchTenant(branchId, tenantId) },
    });
    if (!item) {
      throw new NotFoundException();
    }
    const row = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: body,
    });
    await this.branchMenuCache.invalidateBranch(branchId);
    return row;
  }

  async createModifierGroup(
    branchId: string,
    tenantId: string,
    body: {
      name: string;
      minSelect?: number;
      maxSelect?: number;
      required?: boolean;
    },
  ) {
    await this.branches.findOrThrow(branchId, tenantId);
    const row = await this.prisma.modifierGroup.create({
      data: {
        branchId,
        name: body.name,
        minSelect: body.minSelect ?? 0,
        maxSelect: body.maxSelect ?? 1,
        required: body.required ?? false,
      },
    });
    await this.branchMenuCache.invalidateBranch(branchId);
    return row;
  }

  async addModifierOption(
    groupId: string,
    branchId: string,
    tenantId: string,
    body: { name: string; priceDelta?: number },
  ) {
    const g = await this.prisma.modifierGroup.findFirst({
      where: { id: groupId, ...whereUnderBranchTenant(branchId, tenantId) },
    });
    if (!g) {
      throw new NotFoundException();
    }
    const row = await this.prisma.modifierOption.create({
      data: { groupId, name: body.name, priceDelta: body.priceDelta ?? 0 },
    });
    await this.branchMenuCache.invalidateBranch(branchId);
    return row;
  }

  async linkModifierToItem(
    menuItemId: string,
    modifierGroupId: string,
    branchId: string,
    tenantId: string,
  ) {
    await this.ensureItem(menuItemId, branchId, tenantId);
    const g = await this.prisma.modifierGroup.findFirst({
      where: {
        id: modifierGroupId,
        ...whereUnderBranchTenant(branchId, tenantId),
      },
    });
    if (!g) {
      throw new NotFoundException('Group');
    }
    const row = await this.prisma.menuItemModifierGroup.create({
      data: { menuItemId, modifierGroupId },
    });
    await this.branchMenuCache.invalidateBranch(branchId);
    return row;
  }

  private async ensureItem(itemId: string, branchId: string, tenantId: string) {
    const i = await this.prisma.menuItem.findFirst({
      where: { id: itemId, ...whereUnderBranchTenant(branchId, tenantId) },
    });
    if (!i) {
      throw new NotFoundException('Item');
    }
    return i;
  }

  private validateImportPayload(payload: MenuImportPayloadDto): {
    itemCount: number;
    errors: string[];
  } {
    const errors: string[] = [];
    if (!payload.categories?.length) {
      errors.push('At least one category is required.');
      return { itemCount: 0, errors };
    }
    let itemCount = 0;
    payload.categories.forEach((cat, ci) => {
      if (!cat.items?.length) {
        errors.push(
          `Category ${ci + 1} (${cat.name}): needs at least one item.`,
        );
      }
      cat.items?.forEach((it, ii) => {
        itemCount += 1;
        if (it.priceMinor > 100_000_000) {
          errors.push(
            `Category "${cat.name}" item ${ii + 1}: priceMinor too large.`,
          );
        }
      });
    });
    if (itemCount > MENU_IMPORT_MAX_ITEMS_PER_APPLY) {
      errors.push(
        `Import exceeds cap of ${MENU_IMPORT_MAX_ITEMS_PER_APPLY} line items per apply.`,
      );
    }
    return { itemCount, errors };
  }

  async importDryRun(
    branchId: string,
    tenantId: string,
    payload: MenuImportPayloadDto,
  ) {
    await this.branches.findOrThrow(branchId, tenantId);
    const { itemCount, errors } = this.validateImportPayload(payload);
    return {
      ok: errors.length === 0,
      itemCount,
      categoryCount: payload.categories?.length ?? 0,
      errors,
    };
  }

  async importApply(
    branchId: string,
    tenantId: string,
    actorId: string,
    payload: MenuImportPayloadDto,
  ) {
    await this.branches.findOrThrow(branchId, tenantId);
    const { itemCount, errors } = this.validateImportPayload(payload);
    if (errors.length) {
      throw new BadRequestException({
        message: 'IMPORT_VALIDATION_FAILED',
        errors,
      });
    }
    if (itemCount === 0) {
      throw new BadRequestException('NO_ITEMS');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      let items = 0;
      let cats = 0;
      for (let ci = 0; ci < payload.categories.length; ci++) {
        const cat = payload.categories[ci];
        const c = await tx.menuCategory.create({
          data: {
            branchId,
            name: cat.name.trim(),
            sortOrder: cat.sortOrder ?? ci,
          },
        });
        cats += 1;
        for (let ii = 0; ii < cat.items.length; ii++) {
          const it = cat.items[ii];
          await tx.menuItem.create({
            data: {
              branchId,
              categoryId: c.id,
              name: it.name.trim(),
              description: it.description?.trim(),
              priceMinor: it.priceMinor,
              prepStation:
                (it.prepStation as PrepStation) ?? PrepStation.KITCHEN,
              sortOrder: ii,
            },
          });
          items += 1;
        }
      }
      return { categoriesCreated: cats, itemsCreated: items };
    });

    await this.audit.log({
      tenantId,
      branchId,
      actorId,
      action: 'menu.import_applied',
      entity: 'branch',
      entityId: branchId,
      metadata: {
        categoriesCreated: created.categoriesCreated,
        itemsCreated: created.itemsCreated,
      },
    });

    await this.branchMenuCache.invalidateBranch(branchId);

    return created;
  }
}
