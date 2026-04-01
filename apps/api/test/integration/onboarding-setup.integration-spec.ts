/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Onboarding / setup integration test.
 *
 * Covers: ops-snapshot, setup-readiness, onboarding-status, config-snapshot,
 * patchBranch, onboarding-ui PATCH, go-live-ack POST, and permission enforcement.
 *
 * IMPORTANT: Restores branch qrOrderingEnabled to true after the test that mutates it.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { staffAuthHeaders } from './staff-request-headers';

describe('Onboarding / setup flow (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let branchId: string;
  let tenantId: string;
  let ownerToken: string;
  let noSettingsToken: string;
  let noSettingsUserId: string | undefined;
  let noSettingsRoleId: string | undefined;
  let smokePaidOrderId: string | undefined;

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

    // Create a role with all permissions EXCEPT settings.manage
    const role = await prisma.role.create({
      data: { tenantId, name: `no-settings-${Date.now()}` },
    });
    noSettingsRoleId = role.id;

    const allPerms = await prisma.permission.findMany();
    for (const p of allPerms) {
      if (p.code === 'settings.manage') continue;
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id },
      });
    }

    const hash = await bcrypt.hash('settings-test-12345', 10);
    const user = await prisma.user.create({
      data: {
        email: `no-settings-${Date.now()}@test.local`,
        passwordHash: hash,
        displayName: 'No Settings',
      },
    });
    noSettingsUserId = user.id;
    await prisma.tenantMember.create({
      data: { userId: user.id, tenantId, roleId: role.id },
    });

    const staffLogin = await request(nestApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'settings-test-12345' });
    expect(staffLogin.status).toBe(200);
    noSettingsToken = staffLogin.body.accessToken as string;
  });

  afterAll(async () => {
    try {
      // Restore branch settings in case tests mutated them
      await prisma.branch
        .update({
          where: { id: branchId },
          data: {
            settings: { qrOrderingEnabled: true, qrCallWaiterEnabled: true },
          },
        })
        .catch(() => undefined);

      if (smokePaidOrderId) {
        await prisma.order
          .delete({ where: { id: smokePaidOrderId } })
          .catch(() => undefined);
      }

      // Clear go-live-ack from settings JSON if set during tests
      const branch = await prisma.branch
        .findUnique({ where: { id: branchId } })
        .catch(() => null);
      if (branch?.settings && typeof branch.settings === 'object') {
        const settings = branch.settings as Record<string, unknown>;
        const ui = (settings['onboardingUi'] ?? {}) as Record<string, unknown>;
        delete ui['goLiveAcknowledgedAt'];
        settings['onboardingUi'] = ui;
        await prisma.branch
          .update({
            where: { id: branchId },
            data: { settings: settings as object },
          })
          .catch(() => undefined);
      }

      if (noSettingsUserId) {
        await prisma.tenantMember
          .deleteMany({ where: { userId: noSettingsUserId } })
          .catch(() => undefined);
        await prisma.user
          .delete({ where: { id: noSettingsUserId } })
          .catch(() => undefined);
      }
      if (noSettingsRoleId) {
        await prisma.rolePermission
          .deleteMany({ where: { roleId: noSettingsRoleId } })
          .catch(() => undefined);
        await prisma.role
          .delete({ where: { id: noSettingsRoleId } })
          .catch(() => undefined);
      }
    } finally {
      if (app) await app.close();
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it('GET /ops-snapshot returns exact shape (no PII)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/branches/${branchId}/ops-snapshot`)
      .set(staffAuthHeaders(ownerToken, branchId));

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;

    // Exact shape check — these 4 fields, no PII
    expect(typeof body.readyForGoLive).toBe('boolean');
    expect(typeof body.blockingIncompleteCount).toBe('number');
    expect(typeof body.lowStockCount).toBe('number');
    expect(typeof body.openShiftPresent).toBe('boolean');

    // No PII fields
    expect(body.phone).toBeUndefined();
    expect(body.email).toBeUndefined();
    expect(body.name).toBeUndefined();
  });

  it('GET /setup-readiness returns 200 for any branch member', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/branches/${branchId}/setup-readiness`)
      .set(staffAuthHeaders(noSettingsToken, branchId));

    expect(res.status).toBe(200);
  });

  it('GET /ops-snapshot returns 200 for any branch member (no settings.manage needed)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/branches/${branchId}/ops-snapshot`)
      .set(staffAuthHeaders(noSettingsToken, branchId));

    expect(res.status).toBe(200);
  });

  it('GET /onboarding-status returns correct shape', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/branches/${branchId}/onboarding-status`)
      .set(staffAuthHeaders(ownerToken, branchId));

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(typeof body.branchSlug).toBe('string');
    expect(Array.isArray(body.steps)).toBe(true);
    expect(typeof body.progressPercent).toBe('number');
    expect(typeof body.blockingIncompleteCount).toBe('number');
    expect(typeof body.readyForGoLive).toBe('boolean');
  });

  it('GET /config-snapshot returns correct shape', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/branches/${branchId}/config-snapshot`)
      .set(staffAuthHeaders(ownerToken, branchId));

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    const branch = body.branch as Record<string, unknown>;
    expect(typeof branch.id).toBe('string');
    expect(typeof branch.name).toBe('string');
    expect(typeof branch.slug).toBe('string');
    expect(typeof branch.timezone).toBe('string');
    expect(typeof branch.currency).toBe('string');

    const settings = branch.settings as Record<string, unknown>;
    expect(typeof settings.qrOrderingEnabled).toBe('boolean');
    expect(typeof settings.qrCallWaiterEnabled).toBe('boolean');

    const env = body.environment as Record<string, unknown>;
    expect(typeof env.appPublicUrlConfigured).toBe('boolean');
  });

  it('PATCH /tenants/branches/:b updates branch settings', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/tenants/branches/${branchId}`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ qrOrderingEnabled: false });

    expect(res.status).toBe(200);

    // Restore
    await request(app.getHttpServer())
      .patch(`/api/v1/tenants/branches/${branchId}`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ qrOrderingEnabled: true });
  });

  it('PATCH /onboarding-ui snoozes a step', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/tenants/branches/${branchId}/onboarding-ui`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ stepId: 'session', snoozeDays: 7 });

    expect(res.status).toBe(200);
  });

  it('POST /go-live-ack returns ok:true with acknowledgedAt timestamp', async () => {
    if (!smokePaidOrderId) {
      const smoke = await prisma.order.create({
        data: {
          tenantId,
          branchId,
          type: 'TAKEAWAY',
          status: 'PAID',
          subtotalMinor: 0,
          totalMinor: 0,
          paidAt: new Date(),
        },
      });
      smokePaidOrderId = smoke.id;
    }

    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/branches/${branchId}/go-live-ack`)
      .set(staffAuthHeaders(ownerToken, branchId))
      .send({ confirm: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    expect(typeof res.body.acknowledgedAt).toBe('string');
    // Must be parseable as an ISO date
    expect(() => new Date(res.body.acknowledgedAt as string)).not.toThrow();
  });

  it('GET /onboarding-status: role without settings.manage gets 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/branches/${branchId}/onboarding-status`)
      .set(staffAuthHeaders(noSettingsToken, branchId));

    expect(res.status).toBe(403);
  });

  it('GET /config-snapshot: role without settings.manage gets 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/branches/${branchId}/config-snapshot`)
      .set(staffAuthHeaders(noSettingsToken, branchId));

    expect(res.status).toBe(403);
  });

  it('PATCH /tenants/branches/:b: role without settings.manage gets 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/tenants/branches/${branchId}`)
      .set(staffAuthHeaders(noSettingsToken, branchId))
      .send({ qrOrderingEnabled: false });

    expect(res.status).toBe(403);
  });

  it('POST /go-live-ack: role without settings.manage gets 403', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/branches/${branchId}/go-live-ack`)
      .set(staffAuthHeaders(noSettingsToken, branchId))
      .send({ confirm: true });

    expect(res.status).toBe(403);
  });
});
