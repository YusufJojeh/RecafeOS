/**
 * Branch-scoped Socket.IO event names and payloads (v1 contract).
 *
 * **Versioning:** bump `REALTIME_CONTRACT_VERSION` when you rename an event or change a
 * payload shape in a breaking way; update `ops-web` listeners and any other consumers in the same release.
 */
export const REALTIME_CONTRACT_VERSION = 1 as const;

export const BranchRealtimeEvent = {
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_SENT_TO_PREPARATION: 'order.sent_to_preparation',
  ORDER_PAID: 'order.paid',
  ORDER_MOVED: 'order.moved',
  ORDER_CANCELLED: 'order.cancelled',
  TICKET_UPDATED: 'ticket.updated',
  WAITER_CALL: 'waiter_call',
} as const;

export type BranchRealtimeEventName =
  (typeof BranchRealtimeEvent)[keyof typeof BranchRealtimeEvent];

/** Payload map — keep in sync with OpsGateway emit sites. */
export type BranchRealtimePayloads = {
  [BranchRealtimeEvent.ORDER_CREATED]: { orderId: string };
  [BranchRealtimeEvent.ORDER_UPDATED]: { orderId: string; status?: string };
  [BranchRealtimeEvent.ORDER_SENT_TO_PREPARATION]: { orderId: string };
  [BranchRealtimeEvent.ORDER_PAID]: { orderId: string };
  [BranchRealtimeEvent.ORDER_MOVED]: { orderId: string };
  [BranchRealtimeEvent.ORDER_CANCELLED]: { orderId: string };
  [BranchRealtimeEvent.TICKET_UPDATED]: {
    /** Optional ids; clients refetch lists — source of truth is HTTP. */
    ticketId?: string;
    status?: string;
    orderId?: string;
    /** When set, ops-web may invalidate only this station’s React Query cache. */
    station?: 'KITCHEN' | 'BAR';
  };
  [BranchRealtimeEvent.WAITER_CALL]: { callId: string; tableSessionId: string };
};
