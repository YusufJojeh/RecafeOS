/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Menu management integration test.
 *
 * Covers: categories, items, PATCH item, GET categories list, menu import dry-run,
 * menu import apply, and permission enforcement (menu.manage for writes; GET categories: menu.read | menu.manage | orders.create).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from 'src/app.module';

function authHeaders(token: string, branchId: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Branch-Id': branchId,
  };
}

const IMPORT_PAYLOAD = {
  categories: [
    {
      name: 'Integration Import Cat',
      items: [
        { name: 'Import Item A', priceMinor: 799, prepStation: 'KITCHEN' },
        { name: 'Import Item B', priceMinor: 349, prepStation: 'BAR' },
      ],
    },
  ],
};

describe('Menu management (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let branchId: string;
  let tenantId: string;
  let ownerToken: string;
  let noMenuToken: string;
  let noMenuUserId: string | undefined;
  let noMenuRoleId: string | undefined;
  let ordersCreateOnlyUserId: string | undefined;
  let ordersCreateOnlyRoleId: string | undefined;

  // IDs created during tests — cleaned up in afterAll
  let createdCategoryId: string | undefined;
  let createdItemId: string | undefined;
  const importedCategoryNames = ['Integration Import Cat'];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const demo = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (!demo)
      throw new Error('Run migrations + seed before integration tests');
    tenantId = demo.id;

    const main = await prisma.branch.findFirst({
      where: { tenantId: demo.id, slug: 'main' },
    });
    if (!main) throw new Error('Seed must create demo/main branch');
    branchId = main.id;

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

    // Create a role with all permissions EXCEPT menu read paths (read API allows menu.read | menu.manage | orders.create)
    const role = await prisma.role.create({
      data: { tenantId, name: `no-menu-${Date.now()}` },
    });
    noMenuRoleId = role.id;

    const allPerms = await prisma.permission.findMany();
    for (const p of allPerms) {
      if (
        p.code === 'menu.manage' ||
        p.code === 'menu.read' ||
        p.code === 'orders.create'
      ) {
        continue;
      }
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id },
      });
    }

    const hash = await bcrypt.hash('menu-test-12345', 10);
    const user = await prisma.user.create({
      data: {
        email: `no-menu-${Date.now()}@test.local`,
        passwordHash: hash,
        displayName: 'No Menu',
      },
    });
    noMenuUserId = user.id;
    await prisma.tenantMember.create({
      data: { userId: user.id, tenantId, roleId: role.id },
    });

    const staffLogin = await request(nestApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'menu-test-12345' });
    expect(staffLogin.status).toBe(200);
    noMenuToken = staffLogin.body.accessToken as string;
  });

  afterAll(async () => {
    try {
      // Clean up imported items/categories
      for (const catName of importedCategoryNames) {
        const cats = await prisma.menuCategory.findMany({
          where: { branchId, name: catName },
          include: { items: true },
        });
        for (const cat of cats) {
          await prisma.menuItem.deleteMany({ where: { categoryId: cat.id } });
          await prisma.menuCategory.delete({ where: { id: cat.id } });
        }
      }

      if (createdItemId) {
        await prisma.menuItem
          .delete({ where: { id: createdItemId } })
          .catch(() => undefined);
      }
      if (createdCategoryId) {
        await prisma.menuCategory
          .delete({ where: { id: createdCategoryId } })
          .catch(() => undefined);
      }

      // Clean up test user/role
      if (noMenuUserId) {
        await prisma.tenantMember
          .deleteMany({ where: { userId: noMenuUserId } })
          .catch(() => undefined);
        await prisma.user
          .delete({ where: { id: noMenuUserId } })
          .catch(() => undefined);
      }
      if (noMenuRoleId) {
        await prisma.rolePermission
          .deleteMany({ where: { roleId: noMenuRoleId } })
          .catch(() => undefined);
        await prisma.role
          .delete({ where: { id: noMenuRoleId } })
          .catch(() => undefined);
      }
      if (ordersCreateOnlyUserId) {
        await prisma.tenantMember
          .deleteMany({ where: { userId: ordersCreateOnlyUserId } })
          .catch(() => undefined);
        await prisma.user
          .delete({ where: { id: ordersCreateOnlyUserId } })
          .catch(() => undefined);
      }
      if (ordersCreateOnlyRoleId) {
        await prisma.rolePermission
          .deleteMany({ where: { roleId: ordersCreateOnlyRoleId } })
          .catch(() => undefined);
        await prisma.role
          .delete({ where: { id: ordersCreateOnlyRoleId } })
          .catch(() => undefined);
      }
    } finally {
      if (app) await app.close();
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it('POST /menu/categories creates a category', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/menu/categories`)
      .set(authHeaders(ownerToken, branchId))
      .send({ name: 'Integration Test Category' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Integration Test Category' });
    expect(typeof res.body.id).toBe('string');
    createdCategoryId = res.body.id as string;
  });

  it('POST /menu/items creates an item in the category', async () => {
    expect(createdCategoryId).toBeTruthy();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/menu/items`)
      .set(authHeaders(ownerToken, branchId))
      .send({
        name: 'Integration Test Item',
        priceMinor: 1250,
        categoryId: createdCategoryId,
        prepStation: 'KITCHEN',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Integration Test Item',
      priceMinor: 1250,
    });
    expect(typeof res.body.id).toBe('string');
    createdItemId = res.body.id as string;
  });

  it('PATCH /menu/items/:id updates item availability', async () => {
    expect(createdItemId).toBeTruthy();

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/branches/${branchId}/menu/items/${createdItemId}`)
      .set(authHeaders(ownerToken, branchId))
      .send({ available: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: createdItemId, available: false });
  });

  it('GET /menu/categories returns list including created category', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/menu/categories`)
      .set(authHeaders(ownerToken, branchId));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const cat = (
      res.body as { id: string; name: string; items?: unknown[] }[]
    ).find((c) => c.id === createdCategoryId);
    expect(cat).toBeDefined();
    expect(cat?.name).toBe('Integration Test Category');
    // Items are nested in the categories response
    expect(Array.isArray(cat?.items)).toBe(true);
  });

  it('POST /menu/import/dry-run returns ok:true for valid payload', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/menu/import/dry-run`)
      .set(authHeaders(ownerToken, branchId))
      .send(IMPORT_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ok: true });
    expect(typeof res.body.categoryCount).toBe('number');
    expect(typeof res.body.itemCount).toBe('number');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors).toHaveLength(0);
  });

  it('POST /menu/import/apply creates categories and items', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/menu/import/apply`)
      .set(authHeaders(ownerToken, branchId))
      .send(IMPORT_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      categoriesCreated: 1,
      itemsCreated: 2,
    });

    // Verify the category actually exists in DB
    const cat = await prisma.menuCategory.findFirst({
      where: { branchId, name: 'Integration Import Cat' },
    });
    expect(cat).toBeTruthy();
  });

  it('GET /menu/categories: role without menu.read, menu.manage, and orders.create gets 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/menu/categories`)
      .set(authHeaders(noMenuToken, branchId));

    expect(res.status).toBe(403);
  });

  it('POST /menu/categories: role without menu.manage gets 403', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/menu/categories`)
      .set(authHeaders(noMenuToken, branchId))
      .send({ name: 'Should Fail' });

    expect(res.status).toBe(403);
  });

  it('POST /menu/import/dry-run: role without menu.manage gets 403', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/menu/import/dry-run`)
      .set(authHeaders(noMenuToken, branchId))
      .send(IMPORT_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('GET /menu/categories: role with only orders.create succeeds', async () => {
    const perm = await prisma.permission.findUnique({
      where: { code: 'orders.create' },
    });
    expect(perm).toBeTruthy();

    const role = await prisma.role.create({
      data: { tenantId, name: `orders-create-only-${Date.now()}` },
    });
    ordersCreateOnlyRoleId = role.id;
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm!.id },
    });

    const hash = await bcrypt.hash('oc-menu-12345', 10);
    const user = await prisma.user.create({
      data: {
        email: `oc-menu-${Date.now()}@test.local`,
        passwordHash: hash,
        displayName: 'Orders create only',
      },
    });
    ordersCreateOnlyUserId = user.id;
    await prisma.tenantMember.create({
      data: {
        userId: user.id,
        tenantId,
        roleId: role.id,
        defaultBranchId: branchId,
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'oc-menu-12345' });
    expect(loginRes.status).toBe(200);
    const tok = loginRes.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/menu/categories`)
      .set(authHeaders(tok, branchId));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
