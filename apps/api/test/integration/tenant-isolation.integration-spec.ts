/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest response typing */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import {
  staffAuthHeaders,
  staffBearerOnlyHeaders,
} from './staff-request-headers';

function jwtPayload(token: string): { tenantId?: string; sub?: string } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return {};
  }
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
    tenantId?: string;
    sub?: string;
  };
}

describe('AC: tenant and branch isolation (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let mainBranchId: string;
  let sideBranchId: string;
  let accessToken: string;

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
    mainBranchId = main.id;

    const side = await prisma.branch.create({
      data: {
        tenantId: demo.id,
        name: 'Isolation Side',
        slug: `iso-side-${Date.now()}`,
        timezone: 'UTC',
        currency: 'USD',
      },
    });
    sideBranchId = side.id;

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
    expect(accessToken).toBeTruthy();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.branch
      .delete({ where: { id: sideBranchId } })
      .catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  });

  it('refresh rotates tokens and preserves tenant in access JWT', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@demo.local',
        password: 'demo12345',
        tenantSlug: 'demo',
      });
    expect(login.status).toBe(200);
    const tenantId = login.body.tenantId as string;
    const refreshToken = login.body.refreshToken as string;
    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.tenantId).toBe(tenantId);
    const accessToken = refresh.body.accessToken as string;
    expect(jwtPayload(accessToken).tenantId).toBe(tenantId);
  });

  it('GET /health/live returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/ready returns ok when DB is up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.canServeTraffic).toBe(true);
    expect(res.body.summary).toEqual(expect.any(String));
    expect(res.body.dependencies.db.status).toBe('up');
    expect(res.body.dependencies.redis.status).toBe('up');
    expect(res.body.topology.idempotencyMode).toBe('redis_optional');
    expect(res.body.topology.websocketMode).toBe('redis_adapter');
  });

  it('lists orders when X-Branch-Id matches URL branch', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${mainBranchId}/orders`)
      .set(staffAuthHeaders(accessToken, mainBranchId));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('rejects mismatched URL branch and X-Branch-Id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${mainBranchId}/orders`)
      .set(staffAuthHeaders(accessToken, sideBranchId));
    expect(res.status).toBe(403);
  });

  it('rejects branch route requests when X-Branch-Id is missing', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${mainBranchId}/orders`)
      .set(staffBearerOnlyHeaders(accessToken));
    expect(res.status).toBe(400);
  });

  it('rejects branch from another tenant', async () => {
    const hash = await bcrypt.hash('pass12345x', 10);
    const otherTenant = await prisma.tenant.create({
      data: { name: 'Iso Tenant', slug: `iso-tenant-${Date.now()}` },
    });
    const role = await prisma.role.create({
      data: { tenantId: otherTenant.id, name: 'staff' },
    });
    const perm = await prisma.permission.findUnique({
      where: { code: 'orders.edit' },
    });
    if (perm) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      });
    }
    const user = await prisma.user.create({
      data: {
        email: `iso-user-${Date.now()}@test.local`,
        passwordHash: hash,
        displayName: 'Iso User',
      },
    });
    await prisma.tenantMember.create({
      data: { userId: user.id, tenantId: otherTenant.id, roleId: role.id },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'pass12345x' });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${mainBranchId}/orders`)
      .set(staffAuthHeaders(token, mainBranchId));
    expect(res.status).toBe(403);

    await prisma.tenant.delete({ where: { id: otherTenant.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
