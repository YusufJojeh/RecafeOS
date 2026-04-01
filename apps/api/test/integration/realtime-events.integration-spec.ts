/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Realtime events integration test.
 *
 * Proves that OpsGateway.emitBranchEvent is called with the correct event name
 * and payload after each order/ticket mutation. Spies on the gateway directly —
 * no real Socket.IO server needed.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  OrderType,
  PaymentMethod,
  PrepTicketStatus,
  PrismaClient,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { OpsGateway } from 'src/websocket/ops.gateway';
import { BranchRealtimeEvent } from '@restocafe/types';
import { staffAuthHeaders } from './staff-request-headers';

describe('Realtime event emission (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let gateway: OpsGateway;
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
    if (!demo)
      throw new Error('Run migrations + seed before integration tests');

    const main = await prisma.branch.findFirst({
      where: { tenantId: demo.id, slug: 'main' },
    });
    if (!main) throw new Error('Seed must create demo/main branch');
    branchId = main.id;

    const burger = await prisma.menuItem.findFirst({
      where: { branchId, name: 'Classic Burger' },
    });
    const drink = await prisma.menuItem.findFirst({
      where: { branchId, name: 'Cola' },
    });
    if (!burger || !drink)
      throw new Error('Seed must create Classic Burger and Cola menu items');
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

    gateway = app.get(OpsGateway);

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
      if (createdSessionIds.length > 0) {
        const sessions = await prisma.tableSession.findMany({
          where: { id: { in: createdSessionIds } },
          select: { id: true, floorTableId: true, status: true },
        });
        const open = sessions.filter((s) => s.status === 'OPEN');
        if (open.length > 0) {
          await prisma.tableSession.updateMany({
            where: { id: { in: open.map((s) => s.id) } },
            data: { status: 'CLOSED' },
          });
          await prisma.floorTable.updateMany({
            where: { id: { in: open.map((s) => s.floorTableId) } },
            data: { status: 'AVAILABLE' },
          });
        }
      }
    } finally {
      if (app) await app.close();
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ORDER_CREATED: emits order.created after POST /orders', async () => {
    const spy = jest.spyOn(gateway, 'emitBranchEvent');

    const res = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    expect(res.status).toBe(200);
    const orderId = res.body.id as string;
    createdOrderIds.push(orderId);

    expect(spy).toHaveBeenCalledWith(
      branchId,
      BranchRealtimeEvent.ORDER_CREATED,
      { orderId },
    );
  });

  it('ORDER_UPDATED: emits order.updated after confirm', async () => {
    const spy = jest.spyOn(gateway, 'emitBranchEvent');

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

    spy.mockClear();

    const conf = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
      .set(staffAuthHeaders(accessToken, branchId));
    expect(conf.status).toBe(200);

    expect(spy).toHaveBeenCalledWith(
      branchId,
      BranchRealtimeEvent.ORDER_UPDATED,
      expect.objectContaining({ orderId, status: 'CONFIRMED' }),
    );
  });

  it('ORDER_SENT_TO_PREPARATION: emits after send-to-preparation', async () => {
    const spy = jest.spyOn(gateway, 'emitBranchEvent');

    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
      .set(staffAuthHeaders(accessToken, branchId));

    spy.mockClear();

    const prep = await request(app.getHttpServer())
      .post(
        `/api/v1/branches/${branchId}/orders/${orderId}/send-to-preparation`,
      )
      .set(staffAuthHeaders(accessToken, branchId));
    expect(prep.status).toBe(200);

    expect(spy).toHaveBeenCalledWith(
      branchId,
      BranchRealtimeEvent.ORDER_SENT_TO_PREPARATION,
      { orderId },
    );
  });

  it('TICKET_UPDATED with station=KITCHEN: emits after kitchen PATCH', async () => {
    // Build a full order through to IN_PREPARATION so kitchen tickets exist.
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 }); // burger = KITCHEN station

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
    const kTicket = (kRes.body as { id: string; orderId: string }[]).find(
      (t) => t.orderId === orderId,
    );
    expect(kTicket).toBeTruthy();

    const spy = jest.spyOn(gateway, 'emitBranchEvent');

    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/branches/${branchId}/kitchen/tickets/${kTicket!.id}`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ status: PrepTicketStatus.ACCEPTED });
    expect(patch.status).toBe(200);

    expect(spy).toHaveBeenCalledWith(
      branchId,
      BranchRealtimeEvent.TICKET_UPDATED,
      expect.objectContaining({ ticketId: kTicket!.id, station: 'KITCHEN' }),
    );
  });

  it('TICKET_UPDATED with station=BAR: emits after bar PATCH', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ menuItemId: drinkMenuItemId, quantity: 1 }); // drink = BAR station

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
      .set(staffAuthHeaders(accessToken, branchId));

    await request(app.getHttpServer())
      .post(
        `/api/v1/branches/${branchId}/orders/${orderId}/send-to-preparation`,
      )
      .set(staffAuthHeaders(accessToken, branchId));

    const bRes = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/bar/tickets`)
      .set(staffAuthHeaders(accessToken, branchId));
    const bTicket = (bRes.body as { id: string; orderId: string }[]).find(
      (t) => t.orderId === orderId,
    );
    expect(bTicket).toBeTruthy();

    const spy = jest.spyOn(gateway, 'emitBranchEvent');

    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/branches/${branchId}/bar/tickets/${bTicket!.id}`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ status: PrepTicketStatus.ACCEPTED });
    expect(patch.status).toBe(200);

    expect(spy).toHaveBeenCalledWith(
      branchId,
      BranchRealtimeEvent.TICKET_UPDATED,
      expect.objectContaining({ ticketId: bTicket!.id, station: 'BAR' }),
    );
  });

  it('ORDER_PAID: emits order.paid after close', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/items`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ menuItemId: burgerMenuItemId, quantity: 1 });

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/confirm`)
      .set(staffAuthHeaders(accessToken, branchId));

    await request(app.getHttpServer())
      .post(
        `/api/v1/branches/${branchId}/orders/${orderId}/send-to-preparation`,
      )
      .set(staffAuthHeaders(accessToken, branchId));

    // advance kitchen ticket to DELIVERED
    const kRes = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/kitchen/tickets`)
      .set(staffAuthHeaders(accessToken, branchId))
      .query({ station: 'KITCHEN' });
    const kTicket = (kRes.body as { id: string; orderId: string }[]).find(
      (t) => t.orderId === orderId,
    );
    for (const status of [
      PrepTicketStatus.ACCEPTED,
      PrepTicketStatus.PREPARING,
      PrepTicketStatus.READY,
      PrepTicketStatus.DELIVERED,
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${branchId}/kitchen/tickets/${kTicket!.id}`)
        .set(staffAuthHeaders(accessToken, branchId))
        .send({ status });
    }

    await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/served`)
      .set(staffAuthHeaders(accessToken, branchId));

    const spy = jest.spyOn(gateway, 'emitBranchEvent');

    const close = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/close`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ method: PaymentMethod.CASH });
    expect(close.status).toBe(200);

    expect(spy).toHaveBeenCalledWith(branchId, BranchRealtimeEvent.ORDER_PAID, {
      orderId,
    });
  });

  it('ORDER_CANCELLED: emits order.cancelled after cancel', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ type: OrderType.TAKEAWAY });
    const orderId = create.body.id as string;
    createdOrderIds.push(orderId);

    const spy = jest.spyOn(gateway, 'emitBranchEvent');

    const cancel = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/orders/${orderId}/cancel`)
      .set(staffAuthHeaders(accessToken, branchId));
    expect(cancel.status).toBe(200);

    expect(spy).toHaveBeenCalledWith(
      branchId,
      BranchRealtimeEvent.ORDER_CANCELLED,
      { orderId },
    );
  });
});
