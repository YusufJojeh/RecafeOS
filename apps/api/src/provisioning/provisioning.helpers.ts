import type { PrismaClient } from '@prisma/client';
import {
  FloorTableStatus,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PrepStation,
  Prisma,
  TableSessionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  GLOBAL_PERMISSION_CODES,
  ROLE_TEMPLATE_PERMISSIONS,
  type RoleTemplateName,
} from './provisioning.constants';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export async function ensureGlobalPermissions(prisma: DbClient): Promise<void> {
  for (const code of GLOBAL_PERMISSION_CODES) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }
}

/** Replace role permissions with exactly the given permission codes. */
export async function syncRolePermissions(
  prisma: DbClient,
  roleId: string,
  permissionCodes: readonly string[],
): Promise<void> {
  const permissions = await prisma.permission.findMany({
    where: { code: { in: [...permissionCodes] } },
  });
  if (permissions.length !== permissionCodes.length) {
    const found = new Set(permissions.map((p) => p.code));
    const missing = permissionCodes.filter((c) => !found.has(c));
    throw new Error(`Unknown permission codes: ${missing.join(', ')}`);
  }
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId, permissionId: p.id })),
  });
}

/**
 * Creates owner, manager, cashier, kitchen roles for a tenant with default permission sets.
 */
export async function ensureRoleTemplatesForTenant(
  prisma: DbClient,
  tenantId: string,
): Promise<{ ownerRoleId: string }> {
  const templates: RoleTemplateName[] = [
    'owner',
    'manager',
    'cashier',
    'kitchen',
  ];
  let ownerRoleId = '';
  for (const name of templates) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name },
    });
    if (name === 'owner') {
      ownerRoleId = role.id;
    }
    const codes = ROLE_TEMPLATE_PERMISSIONS[name];
    await syncRolePermissions(prisma, role.id, codes);
  }
  return { ownerRoleId };
}

export type SampleMenuResult = {
  burgerId: string;
  drinkId: string;
  categoryId: string;
};

/** Sample menu, modifier group, stock + recipe — idempotent per branch if caller checks counts. */
export async function createSampleMenuAndStock(
  prisma: DbClient,
  branchId: string,
): Promise<SampleMenuResult> {
  const cat = await prisma.menuCategory.create({
    data: {
      branchId,
      name: 'Mains',
      sortOrder: 0,
    },
  });

  const burger = await prisma.menuItem.create({
    data: {
      branchId,
      categoryId: cat.id,
      name: 'Classic Burger',
      description: 'Beef patty, lettuce',
      priceMinor: 1200,
      prepStation: PrepStation.KITCHEN,
      visible: true,
      available: true,
    },
  });

  const drink = await prisma.menuItem.create({
    data: {
      branchId,
      categoryId: cat.id,
      name: 'Cola',
      priceMinor: 350,
      prepStation: PrepStation.BAR,
      visible: true,
      available: true,
    },
  });

  const mg = await prisma.modifierGroup.create({
    data: {
      branchId,
      name: 'Size',
      minSelect: 1,
      maxSelect: 1,
      required: true,
    },
  });

  await prisma.modifierOption.createMany({
    data: [
      { groupId: mg.id, name: 'Regular', priceDelta: 0, sortOrder: 0 },
      { groupId: mg.id, name: 'Large', priceDelta: 200, sortOrder: 1 },
    ],
  });

  await prisma.menuItemModifierGroup.create({
    data: { menuItemId: burger.id, modifierGroupId: mg.id },
  });

  const stock = await prisma.stockItem.create({
    data: {
      branchId,
      name: 'Beef patty',
      unit: 'pcs',
      quantity: new Prisma.Decimal(100),
      lowThreshold: new Prisma.Decimal(10),
    },
  });

  await prisma.itemRecipe.create({
    data: {
      menuItemId: burger.id,
      stockItemId: stock.id,
      qtyPerUnit: new Prisma.Decimal(1),
    },
  });

  return { burgerId: burger.id, drinkId: drink.id, categoryId: cat.id };
}

export async function createFloorTables(
  prisma: DbClient,
  branchId: string,
  tableCount: number,
): Promise<void> {
  if (tableCount <= 0) {
    return;
  }
  await prisma.floorTable.createMany({
    data: Array.from({ length: tableCount }, (_, i) => ({
      branchId,
      label: `T${i + 1}`,
      sortOrder: i,
      status: FloorTableStatus.AVAILABLE,
    })),
  });
}

/** Dev-only: open session + paid order for reports smoke (matches legacy seed). */
export async function createDevSampleOrder(
  prisma: DbClient,
  tenantId: string,
  branchId: string,
  burgerId: string,
  drinkId: string,
): Promise<void> {
  const table = await prisma.floorTable.findFirst({
    where: { branchId, label: 'T1' },
  });
  if (!table) {
    return;
  }
  await prisma.tableSession.create({
    data: {
      branchId,
      floorTableId: table.id,
      guestCount: 2,
      status: TableSessionStatus.OPEN,
    },
  });

  const session = await prisma.tableSession.findFirst({
    where: { branchId, status: TableSessionStatus.OPEN },
  });
  if (!session) {
    return;
  }

  const order = await prisma.order.create({
    data: {
      tenantId,
      branchId,
      type: OrderType.DINE_IN,
      status: OrderStatus.PAID,
      tableSessionId: session.id,
      subtotalMinor: 1550,
      totalMinor: 1550,
      paidAt: new Date(),
    },
  });
  await prisma.orderItem.createMany({
    data: [
      {
        orderId: order.id,
        menuItemId: burgerId,
        quantity: 1,
        unitPriceMinor: 1200,
        lineTotalMinor: 1200,
      },
      {
        orderId: order.id,
        menuItemId: drinkId,
        quantity: 1,
        unitPriceMinor: 350,
        lineTotalMinor: 350,
      },
    ],
  });
  await prisma.payment.create({
    data: {
      orderId: order.id,
      amountMinor: 1550,
      status: PaymentStatus.COMPLETED,
    },
  });
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
