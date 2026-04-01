import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from 'src/app.module';

describe('Internal support UI gateway (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let token: string;
  let tenantId: string;
  const createdFeedbackIds: string[] = [];

  beforeAll(async () => {
    process.env.SUPPORT_UI_ENABLED = 'true';
    process.env.SUPPORT_UI_ALLOWED_EMAILS = 'owner@demo.local';

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
    const server = nestApp.getHttpServer() as Parameters<typeof request>[0];

    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@demo.local', password: 'demo12345' });
    token = login.body.accessToken as string;
    tenantId = login.body.tenantId as string;
  });

  afterAll(async () => {
    delete process.env.SUPPORT_UI_ENABLED;
    delete process.env.SUPPORT_UI_ALLOWED_EMAILS;
    if (createdFeedbackIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          entity: 'pilot_feedback',
          entityId: { in: createdFeedbackIds },
        },
      });
      await prisma.pilotFeedbackItem.deleteMany({
        where: { id: { in: createdFeedbackIds } },
      });
    }
    if (app) {
      await app.close();
    }
    await prisma.$disconnect().catch(() => undefined);
  });

  it('allows diagnostics through JWT-authenticated server-side support gateway without support api key', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server)
      .get('/api/v1/internal/support-ui/diagnostics')
      .set({ Authorization: `Bearer ${token}` });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      service: 'restocafe-api',
    });
    expect(res.body.health.status).toBe('healthy');
    expect(res.body.dependencies.redis.status).toBe('up');
    expect(res.body.topology.idempotencyMode).toBe('redis_optional');
  });

  it('rejects support gateway requests without staff auth', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server).get(
      '/api/v1/internal/support-ui/diagnostics',
    );

    expect([401, 403]).toContain(res.status);
  });

  it('creates pilot feedback through support UI and records supportOperator in audit metadata', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const title = `Integration feedback ${Date.now()}`;
    const res = await request(server)
      .post(`/api/v1/internal/support-ui/tenants/${tenantId}/pilot-feedback`)
      .set({
        Authorization: `Bearer ${token}`,
        'x-support-operator': 'qa+integration@restocafe.local',
      })
      .send({
        feedbackType: 'bug',
        severity: 'sev3',
        title,
        description: 'Critical-path support UI integration test feedback.',
        evidenceQuality: 'verbal_only',
      });

    expect(res.status).toBe(201);
    createdFeedbackIds.push(res.body.id as string);

    const list = await request(server)
      .get(`/api/v1/internal/support-ui/tenants/${tenantId}/pilot-feedback`)
      .set({ Authorization: `Bearer ${token}` })
      .query({ status: 'open', limit: 20 });
    expect(list.status).toBe(200);
    expect(
      (list.body.items as Array<{ id: string }>).some(
        (item) => item.id === (res.body.id as string),
      ),
    ).toBe(true);

    const auditRow = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        action: 'support.pilot_feedback_create',
        entity: 'pilot_feedback',
        entityId: res.body.id as string,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRow).toBeTruthy();
    expect(auditRow?.metadata).toMatchObject({
      supportOperator: 'qa+integration@restocafe.local',
      title,
      feedbackType: 'bug',
    });

    const auditTail = await request(server)
      .get(`/api/v1/internal/support-ui/tenants/${tenantId}/audit-log`)
      .set({ Authorization: `Bearer ${token}` })
      .query({ actionPrefix: 'support.pilot_feedback', limit: 10 });
    expect(auditTail.status).toBe(200);
    expect(
      (
        auditTail.body.items as Array<{ entityId: string; action: string }>
      ).some(
        (item) =>
          item.entityId === (res.body.id as string) &&
          item.action === 'support.pilot_feedback_create',
      ),
    ).toBe(true);
  });

  it('exposes invoice export readiness through the support ui gateway', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server)
      .get(
        `/api/v1/internal/support-ui/tenants/${tenantId}/invoice-export-readiness`,
      )
      .set({ Authorization: `Bearer ${token}` });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tenantId,
      status: 'manual_export',
      hint: expect.any(String),
      futureStripeFields: expect.arrayContaining([
        'stripeCustomerId',
        'stripeSubscriptionId',
      ]),
    });
  });
});

describe('Internal support UI gateway hardening (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let deniedToken: string;
  let deniedUserId: string | undefined;
  let tenantId: string;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    process.env.SUPPORT_UI_ENABLED = 'true';
    process.env.SUPPORT_UI_ALLOWED_EMAILS = 'owner@demo.local';

    prisma = new PrismaClient();
    await prisma.$connect();

    const demo = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (!demo) {
      throw new Error('Seed required');
    }
    tenantId = demo.id;

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
    server = nestApp.getHttpServer() as Parameters<typeof request>[0];

    const allowedLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@demo.local', password: 'demo12345' });
    expect(allowedLogin.status).toBe(200);

    const ownerRole = await prisma.role.findFirst({
      where: { tenantId, name: 'owner' },
      select: { id: true },
    });
    if (!ownerRole) {
      throw new Error('Seed owner role required');
    }

    const deniedPassword = 'support-denied-12345';
    const deniedUser = await prisma.user.create({
      data: {
        email: `support-denied-${Date.now()}@test.local`,
        passwordHash: await bcrypt.hash(deniedPassword, 10),
        displayName: 'Support Denied',
      },
    });
    deniedUserId = deniedUser.id;
    await prisma.tenantMember.create({
      data: {
        userId: deniedUser.id,
        tenantId,
        roleId: ownerRole.id,
      },
    });

    const deniedLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: deniedUser.email, password: deniedPassword });
    deniedToken = deniedLogin.body.accessToken as string;
  });

  afterAll(async () => {
    delete process.env.SUPPORT_UI_ENABLED;
    delete process.env.SUPPORT_UI_ALLOWED_EMAILS;
    if (deniedUserId) {
      await prisma.tenantMember
        .deleteMany({ where: { userId: deniedUserId } })
        .catch(() => undefined);
      await prisma.user
        .delete({ where: { id: deniedUserId } })
        .catch(() => undefined);
    }
    if (app) {
      await app.close();
    }
    await prisma.$disconnect().catch(() => undefined);
  });

  it('returns 403 for authenticated staff not present in the support allowlist', async () => {
    const res = await request(server)
      .get('/api/v1/internal/support-ui/diagnostics')
      .set({ Authorization: `Bearer ${deniedToken}` });

    expect(res.status).toBe(403);
  });
});

describe('Internal support UI disabled mode (integration)', () => {
  let app: INestApplication;
  let token: string;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    process.env.SUPPORT_UI_ENABLED = 'false';
    process.env.SUPPORT_UI_ALLOWED_EMAILS = 'owner@demo.local';

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
    server = nestApp.getHttpServer() as Parameters<typeof request>[0];

    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@demo.local', password: 'demo12345' });
    token = login.body.accessToken as string;
  });

  afterAll(async () => {
    delete process.env.SUPPORT_UI_ENABLED;
    delete process.env.SUPPORT_UI_ALLOWED_EMAILS;
    if (app) {
      await app.close();
    }
  });

  it('returns 404 even for an allowed operator when support ui is disabled at startup', async () => {
    const res = await request(server)
      .get('/api/v1/internal/support-ui/diagnostics')
      .set({ Authorization: `Bearer ${token}` });

    expect(res.status).toBe(404);
  });
});
