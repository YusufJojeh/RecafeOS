/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Customer management integration test.
 *
 * Critical focus: verify GET /customers/:id response shape matches what
 * CustomerLookupPage expects (intelligence + suggestedActions fields).
 *
 * Covers: create, get, patch, addNote, addOffer, tenant-wide search,
 * branch-scoped search, visit-signals, and permission enforcement.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from 'src/app.module';

function authHeaders(token: string, branchId: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Branch-Id': branchId,
  };
}

function tenantHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('Customer management (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let branchId: string;
  let tenantId: string;
  let ownerToken: string;
  let viewOnlyToken: string;
  let viewOnlyUserId: string | undefined;
  let viewOnlyRoleId: string | undefined;

  let createdCustomerId: string | undefined;
  const TEST_PHONE = `+1555${Date.now().toString().slice(-7)}`;

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

    // Create view-only role (customers.view only, no customers.manage)
    const role = await prisma.role.create({
      data: { tenantId, name: `view-only-${Date.now()}` },
    });
    viewOnlyRoleId = role.id;

    const viewPerm = await prisma.permission.findFirst({
      where: { code: 'customers.view' },
    });
    if (viewPerm) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: viewPerm.id },
      });
    }

    const hash = await bcrypt.hash('view-test-12345', 10);
    const user = await prisma.user.create({
      data: {
        email: `view-only-${Date.now()}@test.local`,
        passwordHash: hash,
        displayName: 'View Only',
      },
    });
    viewOnlyUserId = user.id;
    await prisma.tenantMember.create({
      data: { userId: user.id, tenantId, roleId: role.id },
    });

    const viewLogin = await request(nestApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'view-test-12345' });
    expect(viewLogin.status).toBe(200);
    viewOnlyToken = viewLogin.body.accessToken as string;
  });

  afterAll(async () => {
    try {
      if (createdCustomerId) {
        await prisma.offer
          .deleteMany({ where: { customerId: createdCustomerId } })
          .catch(() => undefined);
        await prisma.customerNote
          .deleteMany({ where: { customerId: createdCustomerId } })
          .catch(() => undefined);
        await prisma.customerVisit
          .deleteMany({ where: { customerId: createdCustomerId } })
          .catch(() => undefined);
        await prisma.customer
          .delete({ where: { id: createdCustomerId } })
          .catch(() => undefined);
      }
      if (viewOnlyUserId) {
        await prisma.tenantMember
          .deleteMany({ where: { userId: viewOnlyUserId } })
          .catch(() => undefined);
        await prisma.user
          .delete({ where: { id: viewOnlyUserId } })
          .catch(() => undefined);
      }
      if (viewOnlyRoleId) {
        await prisma.rolePermission
          .deleteMany({ where: { roleId: viewOnlyRoleId } })
          .catch(() => undefined);
        await prisma.role
          .delete({ where: { id: viewOnlyRoleId } })
          .catch(() => undefined);
      }
    } finally {
      if (app) await app.close();
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it('POST /customers creates a customer', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(tenantHeaders(ownerToken))
      .send({ phone: TEST_PHONE, name: 'Integration Test Guest' });

    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.phone).toBe(TEST_PHONE);
    createdCustomerId = res.body.id as string;
  });

  it('GET /customers/:id returns full shape with intelligence + suggestedActions', async () => {
    expect(createdCustomerId).toBeTruthy();

    const res = await request(app.getHttpServer())
      .get(`/api/v1/customers/${createdCustomerId}`)
      .set(tenantHeaders(ownerToken));

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;

    // Core fields
    expect(body.id).toBe(createdCustomerId);
    expect(body.phone).toBe(TEST_PHONE);
    expect(body.name).toBe('Integration Test Guest');
    expect(typeof body.visitCount).toBe('number');
    expect(Array.isArray(body.visits)).toBe(true);
    expect(Array.isArray(body.noteEntries)).toBe(true);
    expect(Array.isArray(body.offers)).toBe(true);
    expect(Array.isArray(body.tags)).toBe(true);

    // intelligence fields — critical for CustomerLookupPage
    expect(body.intelligence).toBeDefined();
    const intel = body.intelligence as Record<string, unknown>;
    expect('daysSinceLastVisit' in intel).toBe(true); // null or number
    expect(typeof intel.visitsLast90Days).toBe('number');
    expect('primaryBranch' in intel).toBe(true); // null or { id, name }
    expect(typeof intel.segment).toBe('string');

    // suggestedActions — can be empty array but must exist
    expect(Array.isArray(body.suggestedActions)).toBe(true);
  });

  it('PATCH /customers/:id updates tags', async () => {
    expect(createdCustomerId).toBeTruthy();

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/customers/${createdCustomerId}`)
      .set(tenantHeaders(ownerToken))
      .send({ tags: ['integration-test', 'vip'] });

    expect(res.status).toBe(200);
  });

  it('POST /customers/:id/notes adds a note', async () => {
    expect(createdCustomerId).toBeTruthy();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/customers/${createdCustomerId}/notes`)
      .set(tenantHeaders(ownerToken))
      .send({ body: 'Allergy: peanuts', category: 'ALLERGY' });

    expect(res.status).toBe(201);
  });

  it('POST /customers/:id/offers adds an offer', async () => {
    expect(createdCustomerId).toBeTruthy();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/customers/${createdCustomerId}/offers`)
      .set(tenantHeaders(ownerToken))
      .send({ title: 'Free coffee', kind: 'MANUAL' });

    expect(res.status).toBe(201);
  });

  it('GET /customers/search returns results for matching query', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/customers/search')
      .query({ q: TEST_PHONE.slice(0, 8) })
      .set(tenantHeaders(ownerToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const hit = (res.body as { id: string }[]).find(
      (c) => c.id === createdCustomerId,
    );
    expect(hit).toBeDefined();
  });

  it('GET /branches/:b/customers/search returns branch-scoped results', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/customers/search`)
      .query({ q: TEST_PHONE.slice(0, 6) })
      .set(authHeaders(ownerToken, branchId));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /branches/:b/customers/visit-signals returns numeric aggregates (no PII)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/branches/${branchId}/customers/visit-signals`)
      .set(authHeaders(ownerToken, branchId));

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    // Must not expose phone/name
    expect(body.phone).toBeUndefined();
    expect(body.name).toBeUndefined();
    // Must have numeric aggregate fields
    const values = Object.values(body);
    const hasNumbers = values.some(
      (v) => typeof v === 'number' || (typeof v === 'object' && v !== null),
    );
    expect(hasNumbers).toBe(true);
  });

  it('POST /customers: view-only role gets 403 (needs customers.manage)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(tenantHeaders(viewOnlyToken))
      .send({ phone: '+15550000002', name: 'Should Fail' });

    expect(res.status).toBe(403);
  });

  it('PATCH /customers/:id: view-only role gets 403 (needs customers.manage)', async () => {
    expect(createdCustomerId).toBeTruthy();

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/customers/${createdCustomerId}`)
      .set(tenantHeaders(viewOnlyToken))
      .send({ tags: ['blocked'] });

    expect(res.status).toBe(403);
  });

  it('GET /customers/:id: view-only role gets 200 (customers.view is sufficient)', async () => {
    expect(createdCustomerId).toBeTruthy();

    const res = await request(app.getHttpServer())
      .get(`/api/v1/customers/${createdCustomerId}`)
      .set(tenantHeaders(viewOnlyToken));

    expect(res.status).toBe(200);
  });
});
