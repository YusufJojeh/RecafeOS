import { Test } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditLog: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = { auditLog: { create: jest.fn().mockResolvedValue({ id: '1' }) } };
    const mod = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(AuditService);
  });

  const params = {
    tenantId: 't1',
    branchId: 'b1',
    actorId: 'u1',
    action: 'order.paid',
    entity: 'Order',
    entityId: 'o1',
  };

  describe('log()', () => {
    it('awaits prisma create and resolves', async () => {
      await service.log(params);
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('propagates DB errors', async () => {
      prisma.auditLog.create.mockRejectedValueOnce(new Error('db down'));
      await expect(service.log(params)).rejects.toThrow('db down');
    });
  });

  describe('logAsync()', () => {
    it('does not throw when DB write fails', async () => {
      prisma.auditLog.create.mockRejectedValueOnce(new Error('db down'));
      // logAsync returns void synchronously — must not throw
      expect(() => service.logAsync(params)).not.toThrow();
      // Let the internal promise settle
      await new Promise((r) => setTimeout(r, 10));
    });

    it('calls prisma create (fire-and-forget)', async () => {
      service.logAsync(params);
      await new Promise((r) => setTimeout(r, 10));
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });
});
