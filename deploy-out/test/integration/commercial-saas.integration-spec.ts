/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from 'src/app.module';

describe('Commercial SaaS backbone (integration)', () => {
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

  it('blocks staff login and JWT when tenant is suspended; reactivate restores access', async () => {
    const slug = `saas-${Date.now()}`;
    const ownerEmail = `owner-${slug}@example.com`;
    const prov = await request(app.getHttpServer())
      .post('/api/v1/support/tenants/provision')
      .set('x-support-api-key', supportKey)
      .send({
        tenantName: 'SaaS Test',
        tenantSlug: slug,
        branchName: 'Main',
        branchSlug: 'main',
        timezone: 'UTC',
        currency: 'USD',
        ownerEmail,
        includeSampleMenu: false,
        tableCount: 0,
        trial: false,
      });
    expect(prov.status).toBe(201);
    const tenantId = prov.body.tenantId as string;

    const loginOk = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: ownerEmail,
        password: prov.body.generatedPassword as string,
        tenantSlug: slug,
      });
    expect(loginOk.status).toBe(200);

    await request(app.getHttpServer())
      .post(`/api/v1/support/tenants/${tenantId}/suspend`)
      .set('x-support-api-key', supportKey)
      .send({ reasonCode: 'customer_request', note: 'integration test' })
      .expect(200);

    const loginBlocked = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: ownerEmail,
        password: prov.body.generatedPassword as string,
        tenantSlug: slug,
      });
    expect(loginBlocked.status).toBe(403);
    expect((loginBlocked.body as { code?: string }).code).toBe(
      'TENANT_SUSPENDED',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/support/tenants/${tenantId}/reactivate`)
      .set('x-support-api-key', supportKey)
      .expect(200);

    const loginAgain = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: ownerEmail,
        password: prov.body.generatedPassword as string,
        tenantSlug: slug,
      });
    expect(loginAgain.status).toBe(200);

    const commerce = await request(app.getHttpServer())
      .get('/api/v1/tenants/commerce')
      .set('Authorization', `Bearer ${loginAgain.body.accessToken as string}`);
    expect(commerce.status).toBe(200);
    expect(commerce.body.billingStatus).toBe('active');
    expect((commerce.body as { access?: { ok?: boolean } }).access?.ok).toBe(
      true,
    );

    await prisma.tenant.deleteMany({ where: { slug } });
    await prisma.user.deleteMany({ where: { email: ownerEmail } });
  });
});
