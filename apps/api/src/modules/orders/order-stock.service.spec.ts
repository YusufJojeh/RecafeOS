import { Test } from '@nestjs/testing';
import { OrderStockService } from './order-stock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('OrderStockService', () => {
  let service: OrderStockService;
  let prisma: {
    customer: { upsert: jest.Mock };
    customerVisit: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      customer: {
        upsert: jest.fn().mockResolvedValue({ id: 'cust1' }),
      },
      customerVisit: {
        create: jest.fn().mockResolvedValue({ id: 'visit1' }),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        OrderStockService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(OrderStockService);
  });

  describe('recordCustomerVisitPostCommit()', () => {
    it('upserts customer and creates visit', async () => {
      await service.recordCustomerVisitPostCommit('t1', 'b1', '+1 234', 'o1');
      expect(prisma.customer.upsert).toHaveBeenCalledWith({
        where: { tenantId_phone: { tenantId: 't1', phone: '+1234' } },
        update: { visitCount: { increment: 1 } },
        create: { tenantId: 't1', phone: '+1234', visitCount: 1 },
      });
      expect(prisma.customerVisit.create).toHaveBeenCalledWith({
        data: { customerId: 'cust1', branchId: 'b1', orderId: 'o1' },
      });
    });

    it('does not throw when customer upsert fails', async () => {
      prisma.customer.upsert.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.recordCustomerVisitPostCommit('t1', 'b1', '555', 'o1'),
      ).resolves.toBeUndefined();
      // Visit should not be created since upsert failed
      expect(prisma.customerVisit.create).not.toHaveBeenCalled();
    });

    it('does not throw when visit create fails', async () => {
      prisma.customerVisit.create.mockRejectedValueOnce(
        new Error('constraint'),
      );
      await expect(
        service.recordCustomerVisitPostCommit('t1', 'b1', '555', 'o1'),
      ).resolves.toBeUndefined();
    });

    it('normalizes phone by stripping whitespace', async () => {
      await service.recordCustomerVisitPostCommit(
        't1',
        'b1',
        ' +1 234 567 ',
        'o1',
      );
      expect(prisma.customer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_phone: { tenantId: 't1', phone: '+1234567' },
          },
        }),
      );
    });
  });
});
