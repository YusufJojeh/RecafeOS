/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest response typing */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from 'src/app.module';

describe('Support provisioning (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const supportKey = process.env.SUPPORT_API_KEY ?? '';

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

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
    if (app) {
      await app.close();
    }
    await prisma.$disconnect();
  });

  it('rejects provision without support API key', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/support/tenants/provision')
      .send({
        tenantName: 'X',
        tenantSlug: 'x-no-key',
        branchName: 'Main',
        branchSlug: 'main',
        timezone: 'UTC',
        currency: 'USD',
        ownerEmail: 'x@example.com',
      });
    expect(res.status).toBe(403);
  });

  it('provisions a tenant and returns credentials payload', async () => {
    const slug = `trial-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/support/tenants/provision')
      .set('x-support-api-key', supportKey)
      .send({
        tenantName: 'Trial Cafe',
        tenantSlug: slug,
        branchName: 'Main',
        branchSlug: 'main',
        timezone: 'UTC',
        currency: 'USD',
        ownerEmail: `owner-${slug}@example.com`,
        includeSampleMenu: true,
        tableCount: 2,
        trial: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBeTruthy();
    expect(res.body.branchId).toBeTruthy();
    expect(res.body.tenantSlug).toBe(slug);
    expect(res.body.generatedPassword).toBeTruthy();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `owner-${slug}@example.com`,
        password: res.body.generatedPassword as string,
        tenantSlug: slug,
      });
    expect(login.status).toBe(200);
    expect(login.body.tenantId).toBe(res.body.tenantId);

    const pilotFb = await request(app.getHttpServer())
      .post('/api/v1/tenants/pilot-feedback')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send({
        category: 'integration',
        severity: 'low',
        message: 'pilot feedback smoke',
      });
    expect(pilotFb.status).toBe(200);

    const lookup = await request(app.getHttpServer())
      .get(`/api/v1/support/lookup/tenant-slug/${encodeURIComponent(slug)}`)
      .set('x-support-api-key', supportKey);
    expect(lookup.status).toBe(200);
    expect(lookup.body.tenantId).toBe(res.body.tenantId);

    const summary = await request(app.getHttpServer())
      .get(`/api/v1/support/tenants/${res.body.tenantId as string}/summary`)
      .set('x-support-api-key', supportKey);
    expect(summary.status).toBe(200);
    expect(summary.body.pilot).toBeDefined();
    expect(summary.body.counts.menuItems).toBeGreaterThan(0);
    expect(summary.body.counts.floorTables).toBeGreaterThan(0);

    const resetWithoutAck = await request(app.getHttpServer())
      .post(`/api/v1/support/tenants/${res.body.tenantId as string}/reset-demo`)
      .set('x-support-api-key', supportKey)
      .send({
        branchId: res.body.branchId as string,
      });
    expect(resetWithoutAck.status).toBe(400);
    expect(String(resetWithoutAck.body?.message ?? '')).toContain(
      'RESET_DEMO_REQUIRES_DEMO_TAG_OR_ACK',
    );

    const reset = await request(app.getHttpServer())
      .post(`/api/v1/support/tenants/${res.body.tenantId as string}/reset-demo`)
      .set('x-support-api-key', supportKey)
      .send({
        branchId: res.body.branchId as string,
        acknowledgeProductionReset: true,
      });
    expect(reset.status).toBe(200);
    expect(reset.body.deletedOrders).toBeGreaterThanOrEqual(0);

    await prisma.tenant.deleteMany({ where: { slug } });
  });
});
