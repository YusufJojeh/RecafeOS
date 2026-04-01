/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { OrderType, PrepTicketStatus, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { staffAuthHeaders } from './staff-request-headers';

describe('Concurrency safety (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let branchId: string;
  let accessToken: string;
  let burgerMenuItemId: string;
  let drinkMenuItemId: string;
  const createdOrderIds: string[] = [];
  const createdSessionIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const demo = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (!demo) {
      throw new Error(
        'Run prisma migrate deploy && prisma db seed before integration tests',
      );
    }
    const main = await prisma.branch.findFirst({
      where: { tenantId: demo.id, slug: 'main' },
    });
    if (!main) {
      throw new Error('Seed must create demo/main branch');
    }
    branchId = main.id;

    const burger = await prisma.menuItem.findFirst({
      where: { branchId, name: 'Classic Burger' },
    });
    const drink = await prisma.menuItem.findFirst({
      where: { branchId, name: 'Cola' },
    });
    if (!burger || !drink) {
      throw new Error('Seed must create Classic Burger and Cola menu items');
    }
    burgerMenuItemId = burger.id;
    drinkMenuItemId = drink.id;

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
    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    try {
      if (createdSessionIds.length > 0) {
        // Collect floor table IDs before deleting sessions so we can reset their status.
        const sessions = await prisma.tableSession.findMany({
          where: { id: { in: createdSessionIds } },
          select: { floorTableId: true },
        });
        const floorTableIds = sessions.map((s) => s.floorTableId);
        await prisma.order.updateMany({
          where: { tableSessionId: { in: createdSessionIds } },
          data: { tableSessionId: null },
        });
        await prisma.tableSession.deleteMany({
          where: { id: { in: createdSessionIds } },
        });
        if (floorTableIds.length > 0) {
          await prisma.floorTable.updateMany({
            where: { id: { in: floorTableIds } },
            data: { status: 'AVAILABLE' },
          });
        }
      }
      if (createdOrderIds.length > 0) {
        await prisma.payment.deleteMany({
          where: { orderId: { in: createdOrderIds } },
        });
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
    } finally {
      if (app) {
        await app.close();
      }
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it('concurrent confirm: single order.confirmed audit', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    expect(create.status).toBe(200);
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });

    const before = await prisma.auditLog.count({
      where: { action: 'order.confirmed', entityId: orderId, branchId },
    });

    const [r1, r2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
        .set(staffAuthHeaders(accessToken, branchId)),
      request(app.getHttpServer())
        .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
        .set(staffAuthHeaders(accessToken, branchId)),
    ]);

    expect([r1.status, r2.status].sort()).toEqual([200, 200]);
    const after = await prisma.auditLog.count({
      where: { action: 'order.confirmed', entityId: orderId, branchId },
    });
    expect(after - before).toBe(1);
  });

  it('concurrent openSession on same table: second request conflicts', async () => {
    const table = await prisma.floorTable.findFirst({
      where: { branchId, label: 'T2' },
    });
    if (!table) {
      throw new Error('Expected floor table T2');
    }
    await prisma.floorTable.update({
      where: { id: table.id },
      data: { status: 'AVAILABLE' },
    });
    await prisma.tableSession.deleteMany({
      where: { branchId, floorTableId: table.id, status: 'OPEN' },
    });

    const path = `/api/v1/branches/${branchId}/tables/sessions`;
    const h = staffAuthHeaders(accessToken, branchId);
    const body = { floorTableId: table.id, guestCount: 1 };

    const [a, b] = await Promise.all([
      request(app.getHttpServer()).post(path).set(h).send(body),
      request(app.getHttpServer()).post(path).set(h).send(body),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const openCount = await prisma.tableSession.count({
      where: { branchId, floorTableId: table.id, status: 'OPEN' },
    });
    expect(openCount).toBe(1);

    const sess = await prisma.tableSession.findFirst({
      where: { branchId, floorTableId: table.id, status: 'OPEN' },
    });
    if (sess) {
      createdSessionIds.push(sess.id);
    }
  });

  it('concurrent merge same source: one succeeds', async () => {
    const a = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    const b = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    const c = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(c.status).toBe(200);
    const idA = a.body.id as string;
    const idB = b.body.id as string;
    const idC = c.body.id as string;
    createdOrderIds.push(idA, idB, idC);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${idB}/items`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });
    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${idA}/items`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ menuItemId: drinkMenuItemId, quantity: 1 });
    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${idC}/items`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });

    const mergePath = `/api/v1/branches/${branchId}/orders/merge`;
    const h = staffAuthHeaders(accessToken, branchId);

    const [m1, m2] = await Promise.all([
      request(app.getHttpServer())
        .post(mergePath)
        .set(h)
        .send({ targetOrderId: idA, sourceOrderId: idB }),
      request(app.getHttpServer())
        .post(mergePath)
        .set(h)
        .send({ targetOrderId: idC, sourceOrderId: idB }),
    ]);

    const ok = [m1.status, m2.status].filter((s) => s === 200).length;
    const conflict = [m1.status, m2.status].filter((s) => s === 409).length;
    expect(ok).toBe(1);
    expect(conflict).toBe(1);

    const src = await prisma.order.findUnique({ where: { id: idB } });
    expect(src?.status).toBe('CANCELLED');
  });

  it('parallel last ticket DELIVERED: single order.ready audit', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    expect(create.status).toBe(200);
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });
    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ menuItemId: drinkMenuItemId, quantity: 1 });

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
      .set(staffAuthHeaders(accessToken, branchId));
    await request(app.getHttpServer())
      .post(
        `/api/v1/branches/${branchId}/orders/${orderId}/send-to-preparation`,
      )
      .set(staffAuthHeaders(accessToken, branchId));

    const kRes = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/kitchen/tickets`)
      .set(staffAuthHeaders(accessToken, branchId))
      .query({ station: 'KITCHEN' });
    const bRes = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/bar/tickets`)
      .set(staffAuthHeaders(accessToken, branchId));

    type TicketRow = { id: string; orderId: string };
    const kTicket = (kRes.body as TicketRow[]).find(
      (t) => t.orderId === orderId,
    );
    const bTicket = (bRes.body as TicketRow[]).find(
      (t) => t.orderId === orderId,
    );
    expect(kTicket).toBeTruthy();
    expect(bTicket).toBeTruthy();

    const advanceToReadyForPatch = async (
      ticketId: string,
      base: 'kitchen' | 'bar',
    ) => {
      const path = `/api/v1/branches/${branchId}/${base}/tickets/${ticketId}`;
      const h = staffAuthHeaders(accessToken, branchId);
      for (const status of [
        PrepTicketStatus.ACCEPTED,
        PrepTicketStatus.PREPARING,
        PrepTicketStatus.READY,
      ]) {
        await request(app.getHttpServer()).patch(path).set(h).send({ status });
      }
    };

    await advanceToReadyForPatch(kTicket!.id, 'kitchen');
    await advanceToReadyForPatch(bTicket!.id, 'bar');

    const beforeReady = await prisma.auditLog.count({
      where: { action: 'order.ready', entityId: orderId, branchId },
    });

    const pathK = `/api/v1/branches/${branchId}/kitchen/tickets/${kTicket!.id}`;
    const pathB = `/api/v1/branches/${branchId}/bar/tickets/${bTicket!.id}`;
    const h = staffAuthHeaders(accessToken, branchId);

    const [p1, p2] = await Promise.all([
      request(app.getHttpServer())
        .patch(pathK)
        .set(h)
        .send({ status: PrepTicketStatus.DELIVERED }),
      request(app.getHttpServer())
        .patch(pathB)
        .set(h)
        .send({ status: PrepTicketStatus.DELIVERED }),
    ]);

    expect(p1.status).toBe(200);
    expect(p2.status).toBe(200);

    const afterReady = await prisma.auditLog.count({
      where: { action: 'order.ready', entityId: orderId, branchId },
    });
    expect(afterReady - beforeReady).toBe(1);
  });
});
