/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest + prisma */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PrepTicketStatus,
  PrismaClient,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from 'src/app.module';

function authHeaders(token: string, branchId: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Branch-Id': branchId,
  };
}

async function advanceTicketToDelivered(
  app: INestApplication,
  branchId: string,
  token: string,
  ticketId: string,
  base: 'kitchen' | 'bar',
) {
  const path = `/api/v1/branches/${branchId}/${base}/tickets/${ticketId}`;
  const steps: PrepTicketStatus[] = [
    PrepTicketStatus.ACCEPTED,
    PrepTicketStatus.PREPARING,
    PrepTicketStatus.READY,
    PrepTicketStatus.DELIVERED,
  ];
  for (const status of steps) {
    const res = await request(app.getHttpServer())
      .patch(path)
      .set(authHeaders(token, branchId))
      .send({ status });
    expect(res.status).toBe(200);
  }
}

describe('Order critical flows (integration)', () => {
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
        await prisma.customerVisit.deleteMany({
          where: { orderId: { in: createdOrderIds } },
        });
        await prisma.order.deleteMany({
          where: { id: { in: createdOrderIds } },
        });
      }
      // Close only sessions explicitly created by this test suite and reset their tables.
      if (createdSessionIds.length > 0) {
        const sessions = await prisma.tableSession.findMany({
          where: { id: { in: createdSessionIds } },
          select: { id: true, floorTableId: true, status: true },
        });
        const openSessions = sessions.filter((s) => s.status === 'OPEN');
        if (openSessions.length > 0) {
          await prisma.tableSession.updateMany({
            where: { id: { in: openSessions.map((s) => s.id) } },
            data: { status: 'CLOSED' },
          });
          await prisma.floorTable.updateMany({
            where: { id: { in: openSessions.map((s) => s.floorTableId) } },
            data: { status: 'AVAILABLE' },
          });
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it('takeaway: create → confirm → prep → deliver all tickets → served → pay', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(authHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    expect(create.status).toBe(200);
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    const add = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(authHeaders(accessToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });
    expect(add.status).toBe(200);

    const conf = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
      .set(authHeaders(accessToken, branchId));
    expect(conf.status).toBe(200);

    const prep = await request(app.getHttpServer())
      .post(
        `/api/v1/branches/${branchId}/orders/${orderId}/send-to-preparation`,
      )
      .set(authHeaders(accessToken, branchId));
    expect(prep.status).toBe(200);

    const kRes = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/kitchen/tickets`)
      .set(authHeaders(accessToken, branchId))
      .query({ station: 'KITCHEN' });
    expect(kRes.status).toBe(200);
    const kTicket = (kRes.body as { id: string; orderId: string }[]).find(
      (t) => t.orderId === orderId,
    );
    expect(kTicket).toBeTruthy();

    await advanceTicketToDelivered(
      app,
      branchId,
      accessToken,
      kTicket!.id,
      'kitchen',
    );

    const ord = await prisma.order.findUnique({ where: { id: orderId } });
    expect(ord?.status).toBe(OrderStatus.READY);

    const served = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/served`)
      .set(authHeaders(accessToken, branchId));
    expect(served.status).toBe(200);

    const close = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/close`)
      .set(authHeaders(accessToken, branchId))
      .send({ method: PaymentMethod.CASH });
    expect(close.status).toBe(200);
    expect(close.body.status).toBe(OrderStatus.PAID);
  });

  it('dine-in: session → order with burger+drink → kitchen + bar tickets → pay releases table', async () => {
    const t2 = await prisma.floorTable.findFirst({
      where: { branchId, label: 'T2' },
    });
    expect(t2).toBeTruthy();

    let session = await prisma.tableSession.findFirst({
      where: { branchId, floorTableId: t2!.id, status: 'OPEN' },
    });
    if (!session) {
      const open = await request(app.getHttpServer())
        .post(`/api/v1/branches/${branchId}/tables/sessions`)
        .set(authHeaders(accessToken, branchId))
        .send({ floorTableId: t2!.id, guestCount: 2 });
      expect(open.status).toBe(200);
      session = await prisma.tableSession.findUnique({
        where: { id: open.body.id as string },
      });
      if (session) {
        createdSessionIds.push(session.id);
      }
    }
    expect(session).toBeTruthy();

    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(authHeaders(accessToken, branchId))
      .send({
        type: OrderType.DINE_IN,
        tableSessionId: session!.id,
      });
    expect(create.status).toBe(200);
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(authHeaders(accessToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });
    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(authHeaders(accessToken, branchId))
      .send({ menuItemId: drinkMenuItemId, quantity: 1 });

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
      .set(authHeaders(accessToken, branchId));
    await request(app.getHttpServer())
      .post(
        `/api/v1/branches/${branchId}/orders/${orderId}/send-to-preparation`,
      )
      .set(authHeaders(accessToken, branchId));

    const kRes = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/kitchen/tickets`)
      .set(authHeaders(accessToken, branchId))
      .query({ station: 'KITCHEN' });
    const bRes = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/bar/tickets`)
      .set(authHeaders(accessToken, branchId));

    const kTicket = (kRes.body as { id: string; orderId: string }[]).find(
      (t) => t.orderId === orderId,
    );
    const bTicket = (bRes.body as { id: string; orderId: string }[]).find(
      (t) => t.orderId === orderId,
    );
    expect(kTicket).toBeTruthy();
    expect(bTicket).toBeTruthy();

    await advanceTicketToDelivered(
      app,
      branchId,
      accessToken,
      kTicket!.id,
      'kitchen',
    );
    await advanceTicketToDelivered(
      app,
      branchId,
      accessToken,
      bTicket!.id,
      'bar',
    );

    const ready = await prisma.order.findUnique({ where: { id: orderId } });
    expect(ready?.status).toBe(OrderStatus.READY);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/served`)
      .set(authHeaders(accessToken, branchId));

    const close = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/close`)
      .set(authHeaders(accessToken, branchId))
      .send({ method: PaymentMethod.CARD, customerPhone: '+10005550001' });
    expect(close.status).toBe(200);

    const visit = await prisma.customerVisit.findFirst({
      where: { orderId, branchId },
    });
    expect(visit).toBeTruthy();

    const ft = await prisma.floorTable.findUnique({ where: { id: t2!.id } });
    expect(ft?.status).toBe('AVAILABLE');
  });

  it('merge: two draft orders merge into target', async () => {
    const a = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(authHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    const b = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(authHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const idA = a.body.id as string;
    const idB = b.body.id as string;
    createdOrderIds.push(idA);
    createdOrderIds.push(idB);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${idA}/items`)
      .set(authHeaders(accessToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });
    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${idB}/items`)
      .set(authHeaders(accessToken, branchId))
      .send({ menuItemId: drinkMenuItemId, quantity: 1 });

    const merge = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/merge`)
      .set(authHeaders(accessToken, branchId))
      .send({ targetOrderId: idA, sourceOrderId: idB });
    expect(merge.status).toBe(200);
    const merged = merge.body as { id: string; items: unknown[] };
    expect(merged.id).toBe(idA);
    expect(merged.items.length).toBe(2);

    const cancelled = await prisma.order.findUnique({ where: { id: idB } });
    expect(cancelled?.status).toBe(OrderStatus.CANCELLED);
  });

  it('move-table: dine-in order moves to another open session', async () => {
    const tables = await prisma.floorTable.findMany({
      where: { branchId, label: { in: ['T1', 'T2'] } },
    });
    expect(tables.length).toBeGreaterThanOrEqual(2);
    const [ta, tb] = tables;

    const openSession = async (floorTableId: string) => {
      const existing = await prisma.tableSession.findFirst({
        where: { branchId, floorTableId, status: 'OPEN' },
      });
      if (existing) {
        return existing.id;
      }
      const res = await request(app.getHttpServer())
        .post(`/api/v1/branches/${branchId}/tables/sessions`)
        .set(authHeaders(accessToken, branchId))
        .send({ floorTableId, guestCount: 1 });
      expect(res.status).toBe(200);
      createdSessionIds.push(res.body.id as string);
      return res.body.id as string;
    };

    const sessA = await openSession(ta.id);
    const sessB = await openSession(tb.id);

    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(authHeaders(accessToken, branchId))
      .send({ type: OrderType.DINE_IN, tableSessionId: sessA });
    expect(create.status).toBe(200);
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    const move = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/move-table`)
      .set(authHeaders(accessToken, branchId))
      .send({ tableSessionId: sessB });
    expect(move.status).toBe(200);
    expect(move.body.tableSessionId).toBe(sessB);
  });

  it('cancel: draft order can be cancelled', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(authHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    const cancel = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/cancel`)
      .set(authHeaders(accessToken, branchId));
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe(OrderStatus.CANCELLED);
  });
});
