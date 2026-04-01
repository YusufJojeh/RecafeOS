/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Public menu + call-waiter integration test.
 *
 * All endpoints are unauthenticated (no Bearer token).
 * Uses the seeded demo/main tenant+branch slugs.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from 'src/app.module';

describe('Public menu + call-waiter (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let branchId: string;
  let publicSessionToken: string | null = null;
  const createdSessionIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const demo = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (!demo)
      throw new Error('Run migrations + seed before integration tests');

    const main = await prisma.branch.findFirst({
      where: { tenantId: demo.id, slug: 'main' },
    });
    if (!main) throw new Error('Seed must create demo/main branch');
    branchId = main.id;

    // Look for a seeded table session with a publicToken, or get any open session
    const session = await prisma.tableSession.findFirst({
      where: { branchId, status: 'OPEN' },
      select: { id: true, publicToken: true },
    });
    if (session?.publicToken) {
      publicSessionToken = session.publicToken;
    } else {
      // Create a table session for call-waiter test
      const table = await prisma.floorTable.findFirst({
        where: { branchId, status: 'AVAILABLE' },
      });
      if (table) {
        const newSession = await prisma.tableSession.create({
          data: {
            branchId,
            floorTableId: table.id,
            guestCount: 1,
            status: 'OPEN',
          },
          select: { id: true, publicToken: true },
        });
        if (newSession.publicToken) {
          publicSessionToken = newSession.publicToken;
          createdSessionIds.push(newSession.id);
        }
        await prisma.floorTable.update({
          where: { id: table.id },
          data: { status: 'OCCUPIED' },
        });
      }
    }

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
  });

  afterAll(async () => {
    try {
      if (createdSessionIds.length > 0) {
        const sessions = await prisma.tableSession.findMany({
          where: { id: { in: createdSessionIds } },
          select: { id: true, floorTableId: true },
        });
        await prisma.tableSession.updateMany({
          where: { id: { in: createdSessionIds } },
          data: { status: 'CLOSED' },
        });
        await prisma.floorTable.updateMany({
          where: { id: { in: sessions.map((s) => s.floorTableId) } },
          data: { status: 'AVAILABLE' },
        });
      }
    } finally {
      if (app) await app.close();
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it('GET /public/tenants/demo/branches/main/menu returns menu without auth', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/public/tenants/demo/branches/main/menu',
    );
    // No Authorization header — this is a public route

    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body.branch).toBeDefined();
    const branch = body.branch as Record<string, unknown>;
    expect(typeof branch.name).toBe('string');

    expect(Array.isArray(body.categories)).toBe(true);
    const cats = body.categories as { name: string; items: unknown[] }[];
    expect(cats.length).toBeGreaterThan(0);

    const firstCat = cats[0];
    expect(typeof firstCat.name).toBe('string');
    expect(Array.isArray(firstCat.items)).toBe(true);

    if (firstCat.items.length > 0) {
      const item = firstCat.items[0] as Record<string, unknown>;
      expect(typeof item.id).toBe('string');
      expect(typeof item.name).toBe('string');
      expect(typeof item.priceMinor).toBe('number');
    }
  });

  it('GET /public/tenants/demo/branches/main/sessions/:token/menu returns menu for an open session token', async () => {
    if (!publicSessionToken) {
      console.warn(
        'No public session token available — skipping session menu test',
      );
      return;
    }

    const res = await request(app.getHttpServer()).get(
      `/api/v1/public/tenants/demo/branches/main/sessions/${publicSessionToken}/menu`,
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.branch.slug).toBe('main');
  });

  it('GET session menu returns 404 when token does not belong to the tenant/branch path', async () => {
    if (!publicSessionToken) {
      console.warn(
        'No public session token available — skipping session menu mismatch test',
      );
      return;
    }

    const res = await request(app.getHttpServer()).get(
      `/api/v1/public/tenants/demo/branches/not-the-branch/sessions/${publicSessionToken}/menu`,
    );

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(500);
  });

  it('GET /public/tenants/nonexistent-slug/branches/main/menu returns 404, not 500', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/public/tenants/nonexistent-slug-xyz/branches/main/menu',
    );

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(500);
  });

  it('POST /public/sessions/:token/call-waiter returns 200 with valid token', async () => {
    if (!publicSessionToken) {
      console.warn(
        'No public session token available — skipping call-waiter test',
      );
      return;
    }

    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/sessions/${publicSessionToken}/call-waiter`)
      .send({ message: 'Need napkins please' });

    expect(res.status).toBe(200);
  });

  it('POST /public/sessions/invalid-token/call-waiter returns 404, not 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/public/sessions/definitely-invalid-token-xyz/call-waiter')
      .send({ message: 'Test' });

    expect(res.status).not.toBe(500);
    expect([400, 404]).toContain(res.status);
  });

  it('public menu endpoint does not require Authorization header', async () => {
    // Deliberately sends no Authorization header — must not get 401
    const res = await request(app.getHttpServer()).get(
      '/api/v1/public/tenants/demo/branches/main/menu',
    );

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it('POST guest order returns 200 with menu item and idempotency', async () => {
    if (!publicSessionToken) {
      console.warn('No public session token — skipping guest order test');
      return;
    }
    const simpleItem = await prisma.menuItem.findFirst({
      where: {
        branchId,
        available: true,
        visible: true,
        modifierGroups: { none: {} },
      },
    });
    if (!simpleItem) {
      console.warn('No modifier-free menu item — skipping guest order test');
      return;
    }
    const idem = `integration-guest-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/public/tenants/demo/branches/main/sessions/${publicSessionToken}/order`,
      )
      .set('Idempotency-Key', idem)
      .send({ items: [{ menuItemId: simpleItem.id, quantity: 1 }] });
    expect(res.status).toBe(200);
    expect(typeof res.body.orderId).toBe('string');
    expect(typeof res.body.orderRef).toBe('string');
    expect(res.body.customerStatus).toBeDefined();

    const replay = await request(app.getHttpServer())
      .post(
        `/api/v1/public/tenants/demo/branches/main/sessions/${publicSessionToken}/order`,
      )
      .set('Idempotency-Key', idem)
      .send({ items: [{ menuItemId: simpleItem.id, quantity: 1 }] });
    expect(replay.status).toBe(200);
    expect(replay.body.orderId).toBe(res.body.orderId);
  });

  it('GET guest order status for same session', async () => {
    if (!publicSessionToken) {
      console.warn('No public session token — skipping guest order status test');
      return;
    }
    const simpleItem = await prisma.menuItem.findFirst({
      where: {
        branchId,
        available: true,
        visible: true,
        modifierGroups: { none: {} },
      },
    });
    if (!simpleItem) {
      console.warn('No modifier-free menu item — skipping guest order status test');
      return;
    }
    const idem = `integration-guest-status-${Date.now()}`;
    const ord = await request(app.getHttpServer())
      .post(
        `/api/v1/public/tenants/demo/branches/main/sessions/${publicSessionToken}/order`,
      )
      .set('Idempotency-Key', idem)
      .send({ items: [{ menuItemId: simpleItem.id, quantity: 1 }] });
    expect(ord.status).toBe(200);
    const st = await request(app.getHttpServer()).get(
      `/api/v1/public/tenants/demo/branches/main/sessions/${publicSessionToken}/orders/${ord.body.orderId}`,
    );
    expect(st.status).toBe(200);
    expect(st.body.orderRef).toBe(ord.body.orderRef);
  });

  it('POST guest order returns 403 when qrOrderingEnabled is false', async () => {
    if (!publicSessionToken) {
      console.warn('No public session token — skipping qr disabled test');
      return;
    }
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const prev = branch?.settings;
    await prisma.branch.update({
      where: { id: branchId },
      data: {
        settings: { ...(prev as object), qrOrderingEnabled: false },
      },
    });
    try {
      const simpleItem = await prisma.menuItem.findFirst({
        where: {
          branchId,
          available: true,
          visible: true,
          modifierGroups: { none: {} },
        },
      });
      if (!simpleItem) {
        console.warn('No modifier-free menu item — skipping qr disabled test');
        return;
      }
      const res = await request(app.getHttpServer())
        .post(
          `/api/v1/public/tenants/demo/branches/main/sessions/${publicSessionToken}/order`,
        )
        .set('Idempotency-Key', `qr-off-${Date.now()}`)
        .send({ items: [{ menuItemId: simpleItem.id, quantity: 1 }] });
      expect(res.status).toBe(403);
    } finally {
      await prisma.branch.update({
        where: { id: branchId },
        data: { settings: prev as object },
      });
    }
  });
});
