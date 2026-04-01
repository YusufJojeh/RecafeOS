import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  whereMenuItemOrderable,
  whereUnderBranchTenant,
} from '../../common/persistence/branch-scope';
import { PrismaService } from '../../prisma/prisma.service';

export type ResolvedModifierLine = {
  modifierOptionId: string;
  priceDeltaMinor: number;
};

/** Validates modifier options belong to branch/tenant and returns price deltas. */
export async function resolveModifierSelections(
  prisma: PrismaService,
  branchId: string,
  tenantId: string,
  modifierOptionIds: string[] | undefined,
): Promise<ResolvedModifierLine[]> {
  if (!modifierOptionIds?.length) {
    return [];
  }
  const unique = [...new Set(modifierOptionIds)];
  const opts = await prisma.modifierOption.findMany({
    where: {
      id: { in: unique },
      group: whereUnderBranchTenant(branchId, tenantId),
    },
    select: { id: true, priceDelta: true },
  });
  if (opts.length !== unique.length) {
    throw new BadRequestException('Invalid modifier');
  }
  const priceById = new Map(opts.map((o) => [o.id, o.priceDelta]));
  return modifierOptionIds.map((id) => ({
    modifierOptionId: id,
    priceDeltaMinor: priceById.get(id)!,
  }));
}

/** Guest QR menu: same as staff orderable plus `visible` (hidden catalog items excluded). */
export function whereMenuItemGuestOrderable(
  menuItemId: string,
  branchId: string,
  tenantId: string,
): Prisma.MenuItemWhereInput {
  return {
    ...whereMenuItemOrderable(menuItemId, branchId, tenantId),
    visible: true,
  };
}

/** Loads menu item for ordering with modifier groups (for future group rules). */
export async function loadMenuItemForOrderLine(
  prisma: PrismaService,
  menuItemId: string,
  branchId: string,
  tenantId: string,
) {
  const item = await prisma.menuItem.findFirst({
    where: whereMenuItemOrderable(menuItemId, branchId, tenantId),
    include: {
      modifierGroups: {
        include: { modifierGroup: { include: { options: true } } },
      },
    },
  });
  if (!item) {
    throw new BadRequestException('Menu item not available');
  }
  return item;
}

/** Loads menu item for guest self-order (visible + available). */
export async function loadMenuItemForGuestOrderLine(
  prisma: PrismaService,
  menuItemId: string,
  branchId: string,
  tenantId: string,
) {
  const item = await prisma.menuItem.findFirst({
    where: whereMenuItemGuestOrderable(menuItemId, branchId, tenantId),
    include: {
      modifierGroups: {
        include: { modifierGroup: { include: { options: true } } },
      },
    },
  });
  if (!item) {
    throw new BadRequestException('Menu item not available');
  }
  return item;
}

type ModifierGroupForValidation = {
  minSelect: number;
  maxSelect: number;
  required: boolean;
  options: { id: string }[];
};

/**
 * Ensures selected options belong to the item's modifier groups and satisfy min/max/required.
 */
export function assertModifierSelectionsMatchGroups(
  groups: ModifierGroupForValidation[],
  modifierOptionIds: string[],
): void {
  const allowed = new Set<string>();
  for (const g of groups) {
    for (const o of g.options) {
      allowed.add(o.id);
    }
  }
  for (const id of modifierOptionIds) {
    if (!allowed.has(id)) {
      throw new BadRequestException('Modifier not allowed for this item');
    }
  }
  for (const g of groups) {
    const n = modifierOptionIds.filter((id) =>
      g.options.some((o) => o.id === id),
    ).length;
    if (n < g.minSelect) {
      throw new BadRequestException('Too few modifier selections for menu item');
    }
    if (g.maxSelect > 0 && n > g.maxSelect) {
      throw new BadRequestException('Too many modifier selections for menu item');
    }
    if (g.required && n < 1) {
      throw new BadRequestException('Required modifier missing for menu item');
    }
  }
}
