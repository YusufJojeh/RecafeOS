import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StaffPushOutboxStatus } from '@prisma/client';
import { BranchRealtimeEvent } from '@restocafe/types';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffPushService } from './staff-push.service';
import { StaffPushProviderPort } from './staff-push-provider.port';
import { StaffPushOutboxWorkerService } from './staff-push-outbox-worker.service';

describe('StaffPushOutboxWorkerService', () => {
  const row = {
    id: 'o1',
    tenantId: 't1',
    branchId: 'b1',
    event: BranchRealtimeEvent.ORDER_PAID,
    payload: { orderId: 'x' },
    attempts: 0,
    status: StaffPushOutboxStatus.PENDING,
    lastError: null as string | null,
    nextAttemptAt: null as Date | null,
    completedAt: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('locks a pending row and completes when provider submits', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(row)
      .mockResolvedValue(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue(undefined);
    const findManyStale = jest.fn().mockResolvedValue([]);
    const deliver = jest
      .fn()
      .mockResolvedValue({ outcome: 'submitted' as const });

    const moduleRef = await Test.createTestingModule({
      providers: [
        StaffPushOutboxWorkerService,
        {
          provide: PrismaService,
          useValue: {
            staffPushOutbox: { findFirst, updateMany, update, findMany: findManyStale },
          },
        },
        {
          provide: StaffPushProviderPort,
          useValue: { deliver },
        },
        {
          provide: StaffPushService,
          useValue: { deleteDevicesWithTokens: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(300) },
        },
      ],
    }).compile();

    const worker = moduleRef.get(StaffPushOutboxWorkerService);
    const n = await worker.drainBatch(3);
    expect(n).toBe(1);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: expect.objectContaining({
          status: StaffPushOutboxStatus.COMPLETED,
          processingStartedAt: null,
        }),
      }),
    );
  });

  it('schedules retry with backoff when provider fails retryable', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(row)
      .mockResolvedValue(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue(undefined);
    const findManyStale = jest.fn().mockResolvedValue([]);
    const deliver = jest.fn().mockResolvedValue({
      outcome: 'failed' as const,
      retryable: true,
      message: 'rate_limited',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        StaffPushOutboxWorkerService,
        {
          provide: PrismaService,
          useValue: {
            staffPushOutbox: { findFirst, updateMany, update, findMany: findManyStale },
          },
        },
        { provide: StaffPushProviderPort, useValue: { deliver } },
        {
          provide: StaffPushService,
          useValue: { deleteDevicesWithTokens: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(300) },
        },
      ],
    }).compile();

    const worker = moduleRef.get(StaffPushOutboxWorkerService);
    await worker.drainBatch(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: expect.objectContaining({
          status: StaffPushOutboxStatus.PENDING,
          attempts: 1,
          lastError: 'rate_limited',
          processingStartedAt: null,
        }),
      }),
    );
  });

  it('prunes invalid tokens and completes when provider reports them', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(row)
      .mockResolvedValue(null);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue(undefined);
    const findManyStale = jest.fn().mockResolvedValue([]);
    const deleteDevicesWithTokens = jest
      .fn()
      .mockResolvedValue({ count: 2 });
    const deliver = jest.fn().mockResolvedValue({
      outcome: 'invalid_tokens' as const,
      tokens: ['tok-a', 'tok-a'],
      message: 'unregistered',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        StaffPushOutboxWorkerService,
        {
          provide: PrismaService,
          useValue: {
            staffPushOutbox: { findFirst, updateMany, update, findMany: findManyStale },
          },
        },
        { provide: StaffPushProviderPort, useValue: { deliver } },
        {
          provide: StaffPushService,
          useValue: { deleteDevicesWithTokens },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(300) },
        },
      ],
    }).compile();

    const worker = moduleRef.get(StaffPushOutboxWorkerService);
    await worker.drainBatch(1);
    expect(deleteDevicesWithTokens).toHaveBeenCalledWith('t1', ['tok-a', 'tok-a']);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StaffPushOutboxStatus.COMPLETED,
          processingStartedAt: null,
        }),
      }),
    );
  });

  it('reclaimStaleProcessing returns stuck PROCESSING rows to PENDING', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'stale1', attempts: 0 }]);
    const update = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        StaffPushOutboxWorkerService,
        {
          provide: PrismaService,
          useValue: {
            staffPushOutbox: { findMany, update },
          },
        },
        { provide: StaffPushProviderPort, useValue: { deliver: jest.fn() } },
        {
          provide: StaffPushService,
          useValue: { deleteDevicesWithTokens: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(300) },
        },
      ],
    }).compile();

    const worker = moduleRef.get(StaffPushOutboxWorkerService);
    const n = await worker.reclaimStaleProcessing();
    expect(n).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stale1' },
        data: expect.objectContaining({
          status: StaffPushOutboxStatus.PENDING,
          attempts: 1,
          lastError: 'stale_processing_reclaim',
          processingStartedAt: null,
        }),
      }),
    );
  });
});
