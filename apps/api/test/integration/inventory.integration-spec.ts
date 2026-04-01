import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { staffAuthHeaders } from './staff-request-headers';

describe('Inventory (integration)', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];
  let prisma: PrismaClient;
  let branchId: string;
  let accessToken: string;
  let stockItemId: string;

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

    const stock = await prisma.stockItem.findFirst({ where: { branchId } });
    if (!stock) {
      throw new Error('Seed stock item required');
    }
    stockItemId = stock.id;

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
    httpServer = nestApp.getHttpServer() as Parameters<typeof request>[0];

    const login = await request(httpServer)
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

  it('lists stock for branch with quantity and lowThreshold', async () => {
    const res = await request(httpServer)
      .get(`/api/v1/branches/${branchId}/inventory/stock`)
      .set(staffAuthHeaders(accessToken, branchId));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const rows = res.body as Array<{
      id: string;
      quantity: unknown;
      lowThreshold: unknown;
    }>;
    const row = rows.find((stockItem) => stockItem.id === stockItemId);
    expect(row).toBeTruthy();
    expect(row).toMatchObject({
      quantity: expect.anything(),
      lowThreshold: expect.anything(),
    });
  });

  it('adjust changes quantity and is visible in list', async () => {
    const before = await prisma.stockItem.findUnique({
      where: { id: stockItemId },
    });
    expect(before).toBeTruthy();

    const res = await request(httpServer)
      .post(`/api/v1/branches/${branchId}/inventory/adjust`)
      .set(staffAuthHeaders(accessToken, branchId))
      .send({ stockItemId, delta: 0, note: 'integration noop' });
    expect(res.status).toBe(200);

    const after = await prisma.stockItem.findUnique({
      where: { id: stockItemId },
    });
    expect(Number(after!.quantity)).toBe(Number(before!.quantity));
  });
});
