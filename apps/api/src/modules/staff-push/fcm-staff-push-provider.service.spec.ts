import { BranchRealtimeEvent, type StaffPushDeliveryEnvelope } from '@restocafe/types';
import {
  staffPushDataPayload,
  staffPushNotificationCopy,
} from './fcm-staff-push-provider.service';

describe('fcm message mapping', () => {
  const envelope = (
    event: StaffPushDeliveryEnvelope['event'],
    payload: StaffPushDeliveryEnvelope['payload'],
  ): StaffPushDeliveryEnvelope => ({
    tenantId: 't1',
    branchId: 'b1',
    event,
    payload,
  });

  it('staffPushDataPayload stringifies envelope for FCM data', () => {
    const e = envelope(BranchRealtimeEvent.ORDER_PAID, { orderId: 'o1' });
    expect(staffPushDataPayload(e)).toEqual({
      event: BranchRealtimeEvent.ORDER_PAID,
      tenantId: 't1',
      branchId: 'b1',
      payload: JSON.stringify({ orderId: 'o1' }),
    });
  });

  it('staffPushNotificationCopy covers waiter_call', () => {
    const e = envelope(BranchRealtimeEvent.WAITER_CALL, {
      callId: 'c1',
      tableSessionId: 's1',
    });
    const n = staffPushNotificationCopy(e);
    expect(n.title).toContain('assistance');
    expect(n.body.length).toBeGreaterThan(0);
  });
});
