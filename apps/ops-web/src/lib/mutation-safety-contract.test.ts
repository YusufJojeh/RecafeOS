import {
  MUTATION_SAFETY_BY_OPERATION,
  MutationSafetyClass,
  OFFLINE_REPLAY_BY_OPERATION,
  OfflineReplayPolicy,
  NotificationReadiness,
  STAFF_API_CONTRACT_NOTE,
} from '@restocafe/types';
import { describe, expect, it } from 'vitest';

describe('@restocafe/types staff contract helpers', () => {
  it('tags close-bill as idempotency-key class', () => {
    expect(MUTATION_SAFETY_BY_OPERATION['POST /branches/:branchId/orders/:orderId/close']).toBe(
      MutationSafetyClass.IDEMPOTENCY_KEY,
    );
  });

  it('classifies kitchen ticket PATCH as optimistic/versioned', () => {
    expect(
      MUTATION_SAFETY_BY_OPERATION['PATCH /branches/:branchId/kitchen/tickets/:ticketId'],
    ).toBe(MutationSafetyClass.OPTIMISTIC_OR_VERSIONED);
  });

  it('classifies order create as idempotency-key (optional header)', () => {
    expect(MUTATION_SAFETY_BY_OPERATION['POST /branches/:branchId/orders']).toBe(
      MutationSafetyClass.IDEMPOTENCY_KEY,
    );
  });

  it('marks only close-bill as safe_to_queue in offline replay map', () => {
    expect(OFFLINE_REPLAY_BY_OPERATION['POST /branches/:branchId/orders/:orderId/close']).toBe(
      OfflineReplayPolicy.SAFE_TO_QUEUE,
    );
    const queued = Object.entries(OFFLINE_REPLAY_BY_OPERATION).filter(
      ([, v]) => v === OfflineReplayPolicy.SAFE_TO_QUEUE,
    );
    expect(queued).toHaveLength(1);
  });

  it('keeps offline replay keys aligned with mutation safety keys', () => {
    expect(Object.keys(OFFLINE_REPLAY_BY_OPERATION).sort()).toEqual(
      Object.keys(MUTATION_SAFETY_BY_OPERATION).sort(),
    );
  });

  it('exposes a monotonic contract note id', () => {
    expect(STAFF_API_CONTRACT_NOTE).toMatch(/^rest_staff_api_mutation_safety_v\d+$/);
  });

  it('documents realtime as implemented for notifications readiness', () => {
    expect(NotificationReadiness.branchRealtimeSocketIo).toBe('implemented');
    expect(NotificationReadiness.realtimeToPushDispatchBridge).toBe('outbox_enqueue');
    expect(NotificationReadiness.mobilePush).toBe('partial_fcm_server_only');
    expect(NotificationReadiness.deliveryWorker).toBe('inprocess_outbox_retries');
    expect(NotificationReadiness.deviceUnregisterApi).toBe('implemented');
  });
});
