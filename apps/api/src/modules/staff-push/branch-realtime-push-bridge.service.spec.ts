import { Test } from '@nestjs/testing';
import { BranchRealtimeEvent } from '@restocafe/types';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffPushDispatchPort } from './staff-push-dispatch.port';
import { BranchRealtimePushBridgeService } from './branch-realtime-push-bridge.service';

describe('BranchRealtimePushBridgeService', () => {
  it('resolves tenant and forwards envelope to dispatch', async () => {
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const dispatch: Pick<StaffPushDispatchPort, 'enqueueFromBranchEvent'> = {
      enqueueFromBranchEvent: enqueue,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BranchRealtimePushBridgeService,
        {
          provide: PrismaService,
          useValue: {
            branch: {
              findFirst: jest.fn().mockResolvedValue({ tenantId: 't1' }),
            },
          },
        },
        { provide: StaffPushDispatchPort, useValue: dispatch },
      ],
    }).compile();

    const bridge = moduleRef.get(BranchRealtimePushBridgeService);
    await bridge.relayFromRealtime('b1', BranchRealtimeEvent.ORDER_PAID, {
      orderId: 'o1',
    });

    expect(enqueue).toHaveBeenCalledWith({
      tenantId: 't1',
      branchId: 'b1',
      event: BranchRealtimeEvent.ORDER_PAID,
      payload: { orderId: 'o1' },
    });
  });
});
