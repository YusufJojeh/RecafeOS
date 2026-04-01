/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from 'src/app.module';

describe('Reports and public API (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let branchId: string;
  let accessToken: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const demo = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (!demo) {
      throw new Error('Seed demo tenant required');
    }
    const main = await prisma.branch.findFirst({
      where: { tenantId: demo.id, slug: 'main' },
    });
    if (!main) {
      throw new Error('Seed main branch required');
    }
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
    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.$disconnect().catch(() => undefined);
  });

  it('GET daily report returns aggregate shape', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/reports/daily`)
      .set({
        Authorization: `Bearer ${accessToken}`,
        'X-Branch-Id': branchId,
      })
      .query({ date: '2000-01-01' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      branchId,
      date: '2000-01-01',
      totalSalesMinor: expect.any(Number),
      orderCount: expect.any(Number),
      averageOrderValueMinor: expect.any(Number),
      salesByOrderType: expect.any(Object),
      orderCountByOrderType: expect.any(Object),
      topItems: expect.any(Array),
      paymentsByMethod: expect.any(Object),
      summary: {
        grossSalesMinor: expect.any(Number),
        netSalesMinor: expect.any(Number),
        totalDiscountMinor: expect.any(Number),
      },
      hourlySales: expect.any(Array),
      sameWeekdayBenchmark: {
        priorSameWeekdaysSampled: expect.any(Number),
        medianNetSalesMinor: expect.any(Number),
        medianOrderCount: expect.any(Number),
      },
      salesByCategory: expect.any(Array),
      cancellations: {
        count: expect.any(Number),
        lostSubtotalMinor: expect.any(Number),
        byReason: expect.any(Array),
      },
      discounts: {
        ordersWithDiscountCount: expect.any(Number),
        totalDiscountMinor: expect.any(Number),
        topReasons: expect.any(Array),
      },
      cashiers: expect.any(Array),
      shifts: expect.any(Array),
      topCustomers: expect.any(Array),
      visits: {
        visitsRecorded: expect.any(Number),
        repeatVisitsAtBranch: expect.any(Number),
        firstTimeVisitsAtBranch: expect.any(Number),
      },
      stock: { lowStockItems: expect.any(Array) },
      flags: expect.any(Array),
    });
    expect(res.body.hourlySales).toHaveLength(24);
  });

  it('GET daily report rejects invalid date query with 400', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/reports/daily`)
      .set({
        Authorization: `Bearer ${accessToken}`,
        'X-Branch-Id': branchId,
      })
      .query({ date: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('GET daily report rejects missing auth with 401', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/reports/daily`)
      .set({
        'X-Branch-Id': branchId,
      })
      .query({ date: '2000-01-01' });
    expect(res.status).toBe(401);
  });

  it('GET weekly digest returns trend and setup summary shape', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/reports/weekly-digest`)
      .set({
        Authorization: `Bearer ${accessToken}`,
        'X-Branch-Id': branchId,
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      branchId,
      branchTimezone: expect.any(String),
      netPaidSalesMinor: expect.any(Number),
      paidOrderCount: expect.any(Number),
      priorPeriod: expect.objectContaining({
        netPaidSalesMinor: expect.any(Number),
        paidOrderCount: expect.any(Number),
      }),
      setup: expect.objectContaining({
        blockingIncompleteCount: expect.any(Number),
      }),
      weekdayComparison: expect.any(Array),
      orderTypeMix: expect.any(Object),
      discountTrends: expect.any(Object),
    });
  });

  it('GET demand profile returns hour bands and distribution', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/reports/demand-profile`)
      .set({
        Authorization: `Bearer ${accessToken}`,
        'X-Branch-Id': branchId,
      })
      .query({ days: 14 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      branchId,
      branchTimezone: expect.any(String),
      window: expect.objectContaining({
        days: 14,
      }),
      hourlySales: expect.any(Array),
      peakContiguousHours: expect.objectContaining({
        startHour: expect.any(Number),
        endHourExclusive: expect.any(Number),
        salesMinor: expect.any(Number),
        shareOfWindowSalesPct: expect.any(Number),
      }),
    });
  });

  it('GET demand profile rejects invalid days with 400', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/reports/demand-profile`)
      .set({
        Authorization: `Bearer ${accessToken}`,
        'X-Branch-Id': branchId,
      })
      .query({ days: 3 });
    expect(res.status).toBe(400);
  });

  it('GET tenant rollup returns aggregate shape (UTC window)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/reports/tenant-rollup')
      .query({ from: '2000-01-01', to: '2000-01-07' })
      .set({ Authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      semantics: 'utc_inclusive_date_range',
      fromUtc: '2000-01-01',
      toUtcInclusive: '2000-01-07',
      paidAtWindow: {
        start: expect.any(String),
        endExclusive: expect.any(String),
      },
      branchLimit: expect.any(Number),
      branchIdsIncluded: expect.any(Array),
      branchesInScope: expect.any(Array),
      netPaidSalesMinor: expect.any(Number),
      paidOrderCount: expect.any(Number),
      averageTicketMinor: expect.any(Number),
      salesByOrderType: expect.any(Object),
      orderCountByOrderType: expect.any(Object),
      topBranchesBySales: expect.any(Array),
      discountPressure: {
        totalDiscountMinor: expect.any(Number),
        ordersWithDiscountCount: expect.any(Number),
      },
      priorPeriod: expect.objectContaining({
        semantics: 'same_duration_utc_immediately_before',
        netPaidSalesMinor: expect.any(Number),
        paidOrderCount: expect.any(Number),
        paidAtWindow: {
          start: expect.any(String),
          endExclusive: expect.any(String),
        },
      }),
    });
  });

  it('GET tenant rollup rejects partial date ranges with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/reports/tenant-rollup')
      .query({ from: '2000-01-01' })
      .set({ Authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(400);
  });

  it('GET tenant rollup rejects reversed date ranges with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/reports/tenant-rollup')
      .query({ from: '2000-01-07', to: '2000-01-01' })
      .set({ Authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(400);
  });

  it('GET branch snapshot returns branch-local comparison payload', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/reports/branch-snapshot')
      .query({ date: '2000-01-01' })
      .set({ Authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      date: '2000-01-01',
      branchLimit: expect.any(Number),
      branches: expect.any(Array),
    });
  });

  it('GET repeat customers returns rolling-window customer leaderboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/reports/repeat-customers')
      .query({ days: 30 })
      .set({ Authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      semantics: 'tenant_repeat_customers',
      days: 30,
      branchLimit: expect.any(Number),
      sinceUtc: expect.any(String),
      customers: expect.any(Array),
    });
  });

  it('POST archive stale customer visits rejects invalid years with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants/reports/archive-stale-customer-visits')
      .query({ years: 0 })
      .set({ Authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(400);
  });

  it('POST archive stale customer visits returns deleted counts', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants/reports/archive-stale-customer-visits')
      .query({ years: 30 })
      .set({ Authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      semantics: 'archive_stale_customer_visits',
      years: 30,
      cutoffUtc: expect.any(String),
      deletedVisitRows: expect.any(Number),
    });
  });

  it('GET public menu by slug returns categories and items', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/public/tenants/demo/branches/main/menu',
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it('GET session-scoped public menu returns categories for an open token', async () => {
    let session = await prisma.tableSession.findFirst({
      where: { branchId, status: 'OPEN' },
    });
    let createdSession = false;
    if (!session) {
      const table = await prisma.floorTable.findFirst({
        where: { branchId, status: 'AVAILABLE' },
      });
      if (!table) {
        throw new Error('No available floor table for session-menu test');
      }
      const openRes = await request(app.getHttpServer())
        .post(`/api/v1/branches/${branchId}/tables/sessions`)
        .set({
          Authorization: `Bearer ${accessToken}`,
          'X-Branch-Id': branchId,
        })
        .send({ floorTableId: table.id, guestCount: 1 });
      expect(openRes.status).toBe(200);
      session = await prisma.tableSession.findUnique({
        where: { id: openRes.body.id as string },
      });
      createdSession = true;
    }
    expect(session).toBeTruthy();

    const res = await request(app.getHttpServer()).get(
      `/api/v1/public/tenants/demo/branches/main/sessions/${session!.publicToken}/menu`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);

    if (createdSession) {
      await prisma.tableSession.update({
        where: { id: session!.id },
        data: { status: 'CLOSED' },
      });
      await prisma.floorTable.updateMany({
        where: { id: session!.floorTableId },
        data: { status: 'AVAILABLE' },
      });
    }
  });

  it('GET session-scoped public menu returns 404 for a closed session token', async () => {
    const table = await prisma.floorTable.findFirst({
      where: { branchId, status: 'AVAILABLE' },
    });
    if (!table) {
      throw new Error('No available floor table for closed-session menu test');
    }
    const openRes = await request(app.getHttpServer())
      .post(`/api/v1/branches/${branchId}/tables/sessions`)
      .set({
        Authorization: `Bearer ${accessToken}`,
        'X-Branch-Id': branchId,
      })
      .send({ floorTableId: table.id, guestCount: 1 });
    expect(openRes.status).toBe(200);

    const session = await prisma.tableSession.findUniqueOrThrow({
      where: { id: openRes.body.id as string },
    });
    await prisma.tableSession.update({
      where: { id: session.id },
      data: { status: 'CLOSED' },
    });
    await prisma.floorTable.update({
      where: { id: session.floorTableId },
      data: { status: 'AVAILABLE' },
    });

    const res = await request(app.getHttpServer()).get(
      `/api/v1/public/tenants/demo/branches/main/sessions/${session.publicToken}/menu`,
    );
    expect(res.status).toBe(404);
  });

  it('POST call-waiter creates waiter call for valid session token', async () => {
    // Ensure there is an OPEN session to use — create one if needed.
    let session = await prisma.tableSession.findFirst({
      where: { branchId, status: 'OPEN' },
    });
    let createdSession = false;
    if (!session) {
      const table = await prisma.floorTable.findFirst({
        where: { branchId, status: 'AVAILABLE' },
      });
      if (!table) {
        throw new Error('No available floor table for call-waiter test');
      }
      const openRes = await request(app.getHttpServer())
        .post(`/api/v1/branches/${branchId}/tables/sessions`)
        .set({
          Authorization: `Bearer ${accessToken}`,
          'X-Branch-Id': branchId,
        })
        .send({ floorTableId: table.id, guestCount: 1 });
      expect(openRes.status).toBe(200);
      session = await prisma.tableSession.findUnique({
        where: { id: openRes.body.id as string },
      });
      createdSession = true;
    }
    expect(session).toBeTruthy();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/sessions/${session!.publicToken}/call-waiter`)
      .send({ message: 'Integration test' });
    expect(res.status).toBe(200);

    await prisma.waiterCall.deleteMany({
      where: { tableSessionId: session!.id, message: 'Integration test' },
    });
    if (createdSession) {
      await prisma.tableSession.update({
        where: { id: session!.id },
        data: { status: 'CLOSED' },
      });
      await prisma.floorTable.updateMany({
        where: { id: session!.floorTableId },
        data: { status: 'AVAILABLE' },
      });
    }
  });
});
