import type { Prisma } from '@prisma/client';

/** Branch row scoped by tenant (defense in depth beyond header guard). */
export function whereBranchInTenant(
  branchId: string,
  tenantId: string,
): Prisma.BranchWhereInput {
  return { id: branchId, tenantId };
}

/** Entities with direct branchId + Branch.tenant relation. */
export function whereUnderBranchTenant(
  branchId: string,
  tenantId: string,
): {
  branchId: string;
  branch: { tenantId: string };
} {
  return { branchId, branch: { tenantId } };
}

/** Menu item available for ordering in this branch/tenant. */
export function whereMenuItemOrderable(
  menuItemId: string,
  branchId: string,
  tenantId: string,
): Prisma.MenuItemWhereInput {
  return {
    id: menuItemId,
    available: true,
    ...whereUnderBranchTenant(branchId, tenantId),
  };
}

/** Modifier option must belong to a group on this branch/tenant. */
export function whereModifierOptionInBranch(
  optionId: string,
  branchId: string,
  tenantId: string,
): Prisma.ModifierOptionWhereInput {
  return {
    id: optionId,
    group: whereUnderBranchTenant(branchId, tenantId),
  };
}
