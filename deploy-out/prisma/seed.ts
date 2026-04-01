import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  createDevSampleOrder,
  createFloorTables,
  createSampleMenuAndStock,
  ensureGlobalPermissions,
  ensureRoleTemplatesForTenant,
} from '../src/provisioning/provisioning.helpers';

const prisma = new PrismaClient();

async function main() {
  await ensureGlobalPermissions(prisma);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Restaurant', slug: 'demo' },
  });

  const branch = await prisma.branch.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'main' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Main',
      slug: 'main',
      timezone: 'UTC',
      currency: 'USD',
      settings: {
        qrOrderingEnabled: true,
        qrCallWaiterEnabled: true,
      },
    },
  });

  const { ownerRoleId } = await ensureRoleTemplatesForTenant(prisma, tenant.id);

  const passwordHash = await bcrypt.hash('demo12345', 10);
  const user = await prisma.user.upsert({
    where: { email: 'owner@demo.local' },
    update: {},
    create: {
      email: 'owner@demo.local',
      passwordHash,
      displayName: 'Demo Owner',
    },
  });

  await prisma.tenantMember.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: { roleId: ownerRoleId, defaultBranchId: branch.id },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      roleId: ownerRoleId,
      defaultBranchId: branch.id,
    },
  });

  let burgerId: string;
  let drinkId: string;
  const menuCount = await prisma.menuItem.count({ where: { branchId: branch.id } });
  if (menuCount === 0) {
    const sample = await createSampleMenuAndStock(prisma, branch.id);
    burgerId = sample.burgerId;
    drinkId = sample.drinkId;
  } else {
    const items = await prisma.menuItem.findMany({
      where: { branchId: branch.id },
      take: 2,
      orderBy: { createdAt: 'asc' },
    });
    burgerId = items[0]?.id ?? '';
    drinkId = items[1]?.id ?? items[0]?.id ?? '';
  }

  const tableCount = await prisma.floorTable.count({
    where: { branchId: branch.id },
  });
  if (tableCount === 0) {
    await createFloorTables(prisma, branch.id, 2);
  }

  const orderCount = await prisma.order.count({ where: { branchId: branch.id } });
  if (orderCount === 0 && burgerId && drinkId) {
    await createDevSampleOrder(
      prisma,
      tenant.id,
      branch.id,
      burgerId,
      drinkId,
    );
  }

  console.log('Seed OK. Login: owner@demo.local / demo12345');
  console.log('Tenant:', tenant.slug, 'Branch:', branch.slug);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
