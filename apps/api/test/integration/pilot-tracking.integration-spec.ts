/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest response typing */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from 'src/app.module';

describe('Pilot tracking (integration)', () => {
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

  it('PATCH metadata with pilot keys surfaces them on GET summary', async () => {
    const slug = `pilot-meta-${Date.now()}`;
    const provision = await request(app.getHttpServer())
      .post('/api/v1/support/tenants/provision')
      .set('x-support-api-key', supportKey)
      .send({
        tenantName: 'Pilot Meta Test',
        tenantSlug: slug,
        branchName: 'Main',
        branchSlug: 'main',
        timezone: 'UTC',
        currency: 'USD',
        ownerEmail: `owner-${slug}@example.com`,
        trial: true,
      });
    expect(provision.status).toBe(201);
    const tenantId = provision.body.tenantId as string;

    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/support/tenants/${tenantId}/metadata`)
      .set('x-support-api-key', supportKey)
      .send({
        metadata: {
          commercialEngagement: 'pilot',
          venueStatus: 'live',
          goLiveDateActual: '2025-03-01',
          pilotHealth: 'green',
        },
      });
    expect(patch.status).toBe(200);

    const summary = await request(app.getHttpServer())
      .get(`/api/v1/support/tenants/${tenantId}/summary`)
      .set('x-support-api-key', supportKey);
    expect(summary.status).toBe(200);
    expect(summary.body.pilot?.venueStatus).toBe('live');
    expect(summary.body.pilot?.goLiveDateActual).toBe('2025-03-01');
    expect(summary.body.pilot?.pilotHealth).toBe('green');
    expect(summary.body.onboardingRollup).toBeDefined();
  });

  it('POST pilot-feedback then GET list and PATCH triage', async () => {
    const slug = `pilot-fb-${Date.now()}`;
    const provision = await request(app.getHttpServer())
      .post('/api/v1/support/tenants/provision')
      .set('x-support-api-key', supportKey)
      .send({
        tenantName: 'Pilot FB Test',
        tenantSlug: slug,
        branchName: 'Main',
        branchSlug: 'main',
        timezone: 'UTC',
        currency: 'USD',
        ownerEmail: `owner-${slug}@example.com`,
        trial: true,
      });
    expect(provision.status).toBe(201);
    const tenantId = provision.body.tenantId as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/support/tenants/${tenantId}/metadata`)
      .set('x-support-api-key', supportKey)
      .send({
        metadata: { commercialEngagement: 'pilot' },
      });

    const create = await request(app.getHttpServer())
      .post(`/api/v1/support/tenants/${tenantId}/pilot-feedback`)
      .set('x-support-api-key', supportKey)
      .send({
        feedbackType: 'bug',
        severity: 'sev3',
        title: 'Integration test item',
        description: 'desc',
        evidenceQuality: 'verbal_only',
        themeKey: 'test-theme',
        businessCritical: false,
      });
    expect(create.status).toBe(201);
    const feedbackId = create.body.id as string;
    expect(feedbackId).toBeTruthy();

    const list = await request(app.getHttpServer())
      .get(
        `/api/v1/support/tenants/${tenantId}/pilot-feedback?status=open&limit=20`,
      )
      .set('x-support-api-key', supportKey);
    expect(list.status).toBe(200);
    const items = list.body.items as Array<{ id: string }>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((item) => item.id === feedbackId)).toBe(true);

    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/support/tenants/${tenantId}/pilot-feedback/${feedbackId}`)
      .set('x-support-api-key', supportKey)
      .send({
        status: 'triaged',
        triageNotes: 'seen in integration test',
      });
    expect(patch.status).toBe(200);
    expect(patch.body.status).toBe('triaged');

    const weekly = await request(app.getHttpServer())
      .get('/api/v1/support/pilots/weekly-report')
      .set('x-support-api-key', supportKey);
    expect(weekly.status).toBe(200);
    expect(Array.isArray(weekly.body.tenants)).toBe(true);
  });
});
