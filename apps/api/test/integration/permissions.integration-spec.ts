/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { OrderType, PrepTicketStatus, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { staffAuthHeaders } from './staff-request-headers';

describe('Permissions (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let branchId: string;
  let tenantId: string;
  let ownerToken: string;
  let burgerMenuItemId: string;
  let noDiscountToken: string;
  let noDiscountUserId: string | undefined;
  let noDiscountRoleId: string | undefined;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const demo = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (!demo) {
      throw new Error('Seed demo tenant required');
    }
    tenantId = demo.id;
    const main = await prisma.branch.findFirst({
      where: { tenantId: demo.id, slug: 'main' },
    });
    if (!main) {
      throw new Error('Seed main branch required');
    }
    branchId = main.id;

    const burger = await prisma.menuItem.findFirst({
      where: { branchId, name: 'Classic Burger' },
    });
    if (!burger) {
      throw new Error('Seed Classic Burger required');
    }
    burgerMenuItemId = burger.id;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleFixture.createNestApplication();
    nestApp.setGlobalPrefix('api/v1');
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await nestApp.init();
    app = nestApp;

    const login = await request(nestApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@demo.local', password: 'demo12345' });
    expect(login.status).toBe(200);
    ownerToken = login.body.accessToken as string;

    const role = await prisma.role.create({
      data: {
        tenantId,
        name: `no-discount-${Date.now()}`,
      },
    });
    noDiscountRoleId = role.id;

    const allPerms = await prisma.permission.findMany();
    for (const p of allPerms) {
      if (p.code === 'orders.discount') {
        continue;
      }
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id },
      });
    }

    const hash = await bcrypt.hash('perm-test-12345', 10);
    const user = await prisma.user.create({
      data: {
        email: `no-discount-${Date.now()}@test.local`,
        passwordHash: hash,
        displayName: 'No Discount',
      },
    });
    noDiscountUserId = user.id;

    await prisma.tenantMember.create({
      data: {
        userId: user.id,
        tenantId,
        roleId: role.id,
      },
    });

    const staffLogin = await request(nestApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'perm-test-12345' });
    expect(staffLogin.status).toBe(200);
    noDiscountToken = staffLogin.body.accessToken as string;
  });

  afterAll(async () => {
    try {
      if (noDiscountUserId) {
        await prisma.tenantMember
          .deleteMany({ where: { userId: noDiscountUserId } })
          .catch(() => undefined);
        await prisma.user
          .delete({ where: { id: noDiscountUserId } })
          .catch(() => undefined);
      }
      if (noDiscountRoleId) {
        await prisma.rolePermission
          .deleteMany({ where: { roleId: noDiscountRoleId } })
          .catch(() => undefined);
        await prisma.role
          .delete({ where: { id: noDiscountRoleId } })
          .catch(() => undefined);
      }
    } finally {
      if (app) {
        await app.close();
      }
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it('rejects discount when role lacks orders.discount', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(noDiscountToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    expect(create.status).toBe(200);
    const orderId = create.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(noDiscountToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });

    const disc = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/discount`)
      .set(staffAuthHeaders(noDiscountToken, branchId))
      .send({ discountMinor: 100, reason: 'test' });
    expect(disc.status).toBe(403);

    await prisma.order.delete({ where: { id: orderId } });
  });

  it('allows discount for owner (has orders.discount)', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    const orderId = create.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });

    const disc = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/discount`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ discountMinor: 50, reason: 'owner ok' });
    expect(disc.status).toBe(200);

    await prisma.order.delete({ where: { id: orderId } });
  });
});

// ---------------------------------------------------------------------------
// Bar / Kitchen permission isolation
// kitchen.view and bar.view are separate permission codes — they must not bleed.
// ---------------------------------------------------------------------------
describe('Bar/Kitchen permission isolation (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let branchId: string;
  let tenantId: string;
  let ownerToken: string;
  let kitchenOnlyToken: string;
  let kitchenOnlyUserId: string | undefined;
  let kitchenOnlyRoleId: string | undefined;
  let burgerMenuItemId: string;
  let drinkMenuItemId: string;
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const demo = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (!demo) throw new Error('Seed demo tenant required');
    tenantId = demo.id;

    const main = await prisma.branch.findFirst({
      where: { tenantId: demo.id, slug: 'main' },
    });
    if (!main) throw new Error('Seed main branch required');
    branchId = main.id;

    const burger = await prisma.menuItem.findFirst({
      where: { branchId, name: 'Classic Burger' },
    });
    if (!burger) throw new Error('Seed Classic Burger required');
    burgerMenuItemId = burger.id;

    const drink = await prisma.menuItem.findFirst({
      where: { branchId, name: 'Cola' },
    });
    if (!drink) throw new Error('Seed Cola required');
    drinkMenuItemId = drink.id;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleFixture.createNestApplication();
    nestApp.setGlobalPrefix('api/v1');
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await nestApp.init();
    app = nestApp;

    const ownerLogin = await request(nestApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@demo.local', password: 'demo12345' });
    expect(ownerLogin.status).toBe(200);
    ownerToken = ownerLogin.body.accessToken as string;

    // Create a role with kitchen.view but NOT bar.view
    const role = await prisma.role.create({
      data: { tenantId, name: `kitchen-only-${Date.now()}` },
    });
    kitchenOnlyRoleId = role.id;

    const allPerms = await prisma.permission.findMany();
    for (const p of allPerms) {
      if (p.code === 'bar.view') continue; // skip bar.view
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id },
      });
    }

    const hash = await bcrypt.hash('kitchen-test-12345', 10);
    const user = await prisma.user.create({
      data: {
        email: `kitchen-only-${Date.now()}@test.local`,
        passwordHash: hash,
        displayName: 'Kitchen Only',
      },
    });
    kitchenOnlyUserId = user.id;
    await prisma.tenantMember.create({
      data: { userId: user.id, tenantId, roleId: role.id },
    });

    const staffLogin = await request(nestApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'kitchen-test-12345' });
    expect(staffLogin.status).toBe(200);
    kitchenOnlyToken = staffLogin.body.accessToken as string;
  });

  afterAll(async () => {
    try {
      if (createdOrderIds.length > 0) {
        await prisma.preparationTicket.deleteMany({
          where: { orderId: { in: createdOrderIds } },
        });
        await prisma.orderItem.deleteMany({
          where: { orderId: { in: createdOrderIds } },
        });
        await prisma.stockMovement.deleteMany({
          where: { orderId: { in: createdOrderIds } },
        });
        await prisma.order.deleteMany({
          where: { id: { in: createdOrderIds } },
        });
      }
      if (kitchenOnlyUserId) {
        await prisma.tenantMember
          .deleteMany({ where: { userId: kitchenOnlyUserId } })
          .catch(() => undefined);
        await prisma.user
          .delete({ where: { id: kitchenOnlyUserId } })
          .catch(() => undefined);
      }
      if (kitchenOnlyRoleId) {
        await prisma.rolePermission
          .deleteMany({ where: { roleId: kitchenOnlyRoleId } })
          .catch(() => undefined);
        await prisma.role
          .delete({ where: { id: kitchenOnlyRoleId } })
          .catch(() => undefined);
      }
    } finally {
      if (app) await app.close();
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it('kitchen-only role can GET kitchen tickets', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/kitchen/tickets`)
      .query({ station: 'KITCHEN' })
      .set(staffAuthHeaders(kitchenOnlyToken, branchId));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('kitchen-only role gets 403 on GET bar tickets', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/bar/tickets`)
      .set(staffAuthHeaders(kitchenOnlyToken, branchId));

    expect(res.status).toBe(403);
  });

  it('kitchen-only role gets 403 on PATCH bar ticket', async () => {
    // Use owner to build an order with a drink (BAR station) so a bar ticket exists
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    expect(create.status).toBe(200);
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ menuItemId: drinkMenuItemId, quantity: 1 });

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
      .set(staffAuthHeaders(ownerToken, branchId));

    await request(app.getHttpServer())
      .post(
        `/api/v1/branches/${branchId}/orders/${orderId}/send-to-preparation`,
      )
      .set(staffAuthHeaders(ownerToken, branchId));

    const bRes = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/bar/tickets`)
      .set(staffAuthHeaders(ownerToken, branchId));
    const bTicket = (bRes.body as { id: string; orderId: string }[]).find(
      (t) => t.orderId === orderId,
    );
    expect(bTicket).toBeTruthy();

    // kitchen-only role should be forbidden from patching a bar ticket
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/branches/${branchId}/bar/tickets/${bTicket!.id}`)
      .set(staffAuthHeaders(kitchenOnlyToken, branchId))
      .send({ status: PrepTicketStatus.ACCEPTED });

    expect(patch.status).toBe(403);
  });

  it('kitchen-only role can PATCH kitchen ticket', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    expect(create.status).toBe(200);
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 }); // burger = KITCHEN

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
      .set(staffAuthHeaders(ownerToken, branchId));

    await request(app.getHttpServer())
      .post(
        `/api/v1/branches/${branchId}/orders/${orderId}/send-to-preparation`,
      )
      .set(staffAuthHeaders(ownerToken, branchId));

    const kRes = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/kitchen/tickets`)
      .query({ station: 'KITCHEN' })
      .set(staffAuthHeaders(ownerToken, branchId));
    const kTicket = (kRes.body as { id: string; orderId: string }[]).find(
      (t) => t.orderId === orderId,
    );
    expect(kTicket).toBeTruthy();

    // kitchen-only role should be allowed to patch a kitchen ticket
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/branches/${branchId}/kitchen/tickets/${kTicket!.id}`)
      .set(staffAuthHeaders(kitchenOnlyToken, branchId))
      .send({ status: PrepTicketStatus.ACCEPTED });

    expect(patch.status).toBe(200);
  });
});
