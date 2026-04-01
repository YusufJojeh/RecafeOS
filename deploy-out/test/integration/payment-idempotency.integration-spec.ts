/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  OrderType,
  PaymentMethod,
  PrepTicketStatus,
  PrismaClient,
} from '@prisma/client';
import Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from 'src/app.module';

const redisIntegrationUrl = process.env.REDIS_URL?.trim();

async function ticketToDelivered(
  app: INestApplication,
  branchId: string,
  token: string,
  ticketId: string,
  base: 'kitchen' | 'bar',
) {
  const path = `/api/v1/branches/${branchId}/${base}/tickets/${ticketId}`;
  for (const status of [
    PrepTicketStatus.ACCEPTED,
    PrepTicketStatus.PREPARING,
    PrepTicketStatus.READY,
    PrepTicketStatus.DELIVERED,
  ]) {
    await request(app.getHttpServer())
      .patch(path)
      .set({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branchId })
      .send({ status });
  }
}

async function createTakeawayOrderThroughServed(
  app: INestApplication,
  branchId: string,
  token: string,
  burgerMenuItemId: string,
): Promise<string> {
  const h = { Authorization: `Bearer ${token}`, 'X-Branch-Id': branchId };
  const create = await request(app.getHttpServer())
    .post(`/api/v1/branches/${branchId}/orders`)
    .set(h)
    .send({ type: OrderType.TAKEAWAY });
  const orderId = create.body.id as string;

  await request(app.getHttpServer())
    .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
    .set(h)
    .send({ menuItemId: burgerMenuItemId, quantity: 1 });
  await request(app.getHttpServer())
    .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
    .set(h);
  await request(app.getHttpServer())
    .post(`/api/v1/branches/${branchId}/orders/${orderId}/send-to-preparation`)
    .set(h);

  const kRes = await request(app.getHttpServer())
    .get(`/api/v1/branches/${branchId}/kitchen/tickets`)
    .set(h)
    .query({ station: 'KITCHEN' });
  const t = (kRes.body as { id: string; orderId: string }[]).find(
    (x) => x.orderId === orderId,
  );
  if (!t) {
    throw new Error('Expected kitchen ticket');
  }
  await ticketToDelivered(app, branchId, token, t.id, 'kitchen');

  await request(app.getHttpServer())
    .post(`/api/v1/branches/${branchId}/orders/${orderId}/served`)
    .set(h);

  return orderId;
}

describe('Payment close idempotency (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let branchId: string;
  let token: string;
  let burgerMenuItemId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const demo = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (!demo) {
      throw new Error('Seed required');
    }
    const main = await prisma.branch.findFirst({
      where: { tenantId: demo.id, slug: 'main' },
    });
    if (!main) {
      throw new Error('Seed required');
    }
    branchId = main.id;

    const burger = await prisma.menuItem.findFirst({
      where: { branchId, name: 'Classic Burger' },
    });
    if (!burger) {
      throw new Error('Seed burger required');
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
    token = login.body.accessToken as string;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.$disconnect().catch(() => undefined);
  });

  it('repeating close with same idempotency key returns paid order without error', async () => {
    const h = { Authorization: `Bearer ${token}`, 'X-Branch-Id': branchId };
    const orderId = await createTakeawayOrderThroughServed(
      app,
      branchId,
      token,
      burgerMenuItemId,
    );

    const key = `idem-${Date.now()}`;
    const close1 = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/close`)
      .set({ ...h, 'idempotency-key': key })
      .send({ method: PaymentMethod.CASH });
    expect(close1.status).toBe(200);
    expect(close1.body.status).toBe('PAID');

    const close2 = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/close`)
      .set({ ...h, 'idempotency-key': key })
      .send({ method: PaymentMethod.CASH });
    expect(close2.status).toBe(200);
    expect(close2.body?.id).toBe(orderId);

    await prisma.payment.deleteMany({ where: { orderId } });
    await prisma.preparationTicket.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.stockMovement.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
  });

  it('concurrent close without idempotency key creates a single payment', async () => {
    const h = { Authorization: `Bearer ${token}`, 'X-Branch-Id': branchId };
    const orderId = await createTakeawayOrderThroughServed(
      app,
      branchId,
      token,
      burgerMenuItemId,
    );
    const closePath = `/api/v1/branches/${branchId}/orders/${orderId}/close`;

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(closePath)
        .set(h)
        .send({ method: PaymentMethod.CASH }),
      request(app.getHttpServer())
        .post(closePath)
        .set(h)
        .send({ method: PaymentMethod.CASH }),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body?.status).toBe('PAID');
    expect(b.body?.status).toBe('PAID');

    const payCount = await prisma.payment.count({ where: { orderId } });
    expect(payCount).toBe(1);

    await prisma.payment.deleteMany({ where: { orderId } });
    await prisma.preparationTicket.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.stockMovement.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
  });

  it('concurrent close with same idempotency key creates a single payment', async () => {
    const h = { Authorization: `Bearer ${token}`, 'X-Branch-Id': branchId };
    const orderId = await createTakeawayOrderThroughServed(
      app,
      branchId,
      token,
      burgerMenuItemId,
    );
    const closePath = `/api/v1/branches/${branchId}/orders/${orderId}/close`;
    const key = `idem-concurrent-${Date.now()}`;

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(closePath)
        .set({ ...h, 'idempotency-key': key })
        .send({ method: PaymentMethod.CASH }),
      request(app.getHttpServer())
        .post(closePath)
        .set({ ...h, 'idempotency-key': key })
        .send({ method: PaymentMethod.CASH }),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const payCount = await prisma.payment.count({ where: { orderId } });
    expect(payCount).toBe(1);

    await prisma.payment.deleteMany({ where: { orderId } });
    await prisma.preparationTicket.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.stockMovement.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
  });

  it('sequential duplicate close without idempotency key returns paid order once', async () => {
    const h = { Authorization: `Bearer ${token}`, 'X-Branch-Id': branchId };
    const orderId = await createTakeawayOrderThroughServed(
      app,
      branchId,
      token,
      burgerMenuItemId,
    );
    const closePath = `/api/v1/branches/${branchId}/orders/${orderId}/close`;

    const first = await request(app.getHttpServer())
      .post(closePath)
      .set(h)
      .send({ method: PaymentMethod.CASH });
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .post(closePath)
      .set(h)
      .send({ method: PaymentMethod.CASH });
    expect(second.status).toBe(200);
    expect(second.body?.status).toBe('PAID');

    const payCount = await prisma.payment.count({ where: { orderId } });
    expect(payCount).toBe(1);

    await prisma.payment.deleteMany({ where: { orderId } });
    await prisma.preparationTicket.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.stockMovement.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
  });

  it('rejects close-bill while order is only confirmed and creates no payment', async () => {
    const h = { Authorization: `Bearer ${token}`, 'X-Branch-Id': branchId };
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(h)
      .send({ type: OrderType.TAKEAWAY });
    expect(create.status).toBe(200);
    const orderId = create.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(h)
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });
    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
      .set(h);

    const close = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/close`)
      .set(h)
      .send({ method: PaymentMethod.CASH });
    expect(close.status).toBe(409);
    expect(String(close.body?.message ?? '')).toContain(
      'Invalid order transition',
    );

    const payCount = await prisma.payment.count({ where: { orderId } });
    expect(payCount).toBe(0);

    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
  });

  (redisIntegrationUrl ? it : it.skip)(
    'same idempotency key after Redis value deleted still returns paid order (single payment)',
    async () => {
      const h = { Authorization: `Bearer ${token}`, 'X-Branch-Id': branchId };
      const orderId = await createTakeawayOrderThroughServed(
        app,
        branchId,
        token,
        burgerMenuItemId,
      );
      const key = `idem-redis-purge-${Date.now()}`;
      const closePath = `/api/v1/branches/${branchId}/orders/${orderId}/close`;

      const first = await request(app.getHttpServer())
        .post(closePath)
        .set({ ...h, 'idempotency-key': key })
        .send({ method: PaymentMethod.CASH });
      expect(first.status).toBe(200);

      const row = await prisma.order.findUnique({ where: { id: orderId } });
      if (!row?.tenantId) {
        throw new Error('Expected order tenantId');
      }
      const redisKey = `closeBill:${row.tenantId}:${orderId}:${key}`;
      const r = new Redis(redisIntegrationUrl!);
      try {
        await r.del(redisKey);
      } finally {
        await r.quit();
      }

      const second = await request(app.getHttpServer())
        .post(closePath)
        .set({ ...h, 'idempotency-key': key })
        .send({ method: PaymentMethod.CASH });
      expect(second.status).toBe(200);
      expect(second.body?.status).toBe('PAID');

      const payCount = await prisma.payment.count({ where: { orderId } });
      expect(payCount).toBe(1);

      await prisma.payment.deleteMany({ where: { orderId } });
      await prisma.preparationTicket.deleteMany({ where: { orderId } });
      await prisma.orderItem.deleteMany({ where: { orderId } });
      await prisma.stockMovement.deleteMany({ where: { orderId } });
      await prisma.order.delete({ where: { id: orderId } });
    },
  );
});
