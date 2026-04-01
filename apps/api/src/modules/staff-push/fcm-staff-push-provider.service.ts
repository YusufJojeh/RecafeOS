import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';
import {
  BranchRealtimeEvent,
  type StaffPushDeliveryEnvelope,
} from '@restocafe/types';
import {
  StaffPushProviderDeliveryResult,
  StaffPushProviderPort,
} from './staff-push-provider.port';
import { StaffPushService } from './staff-push.service';

/** FCM v1 error codes that indicate the registration token should be dropped. */
const FCM_TOKEN_INVALID_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

function envFlagEnabled(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function staffPushDataPayload(
  envelope: StaffPushDeliveryEnvelope,
): Record<string, string> {
  return {
    event: String(envelope.event),
    tenantId: envelope.tenantId,
    branchId: envelope.branchId,
    payload: JSON.stringify(envelope.payload),
  };
}

export function staffPushNotificationCopy(envelope: StaffPushDeliveryEnvelope): {
  title: string;
  body: string;
} {
  const p = envelope.payload as Record<string, unknown>;
  switch (envelope.event) {
    case BranchRealtimeEvent.ORDER_CREATED:
      return { title: 'New order', body: `Order ${p.orderId ?? ''}`.trim() };
    case BranchRealtimeEvent.ORDER_UPDATED:
      return {
        title: 'Order updated',
        body: `Order ${p.orderId ?? ''}${p.status ? ` · ${p.status}` : ''}`.trim(),
      };
    case BranchRealtimeEvent.ORDER_SENT_TO_PREPARATION:
      return {
        title: 'Order in preparation',
        body: `Order ${p.orderId ?? ''}`.trim(),
      };
    case BranchRealtimeEvent.ORDER_PAID:
      return { title: 'Order paid', body: `Order ${p.orderId ?? ''}`.trim() };
    case BranchRealtimeEvent.ORDER_MOVED:
      return { title: 'Order moved', body: `Order ${p.orderId ?? ''}`.trim() };
    case BranchRealtimeEvent.ORDER_CANCELLED:
      return {
        title: 'Order cancelled',
        body: `Order ${p.orderId ?? ''}`.trim(),
      };
    case BranchRealtimeEvent.TICKET_UPDATED:
      return {
        title: 'Kitchen / bar update',
        body: [p.station, p.orderId ?? p.ticketId].filter(Boolean).join(' · '),
      };
    case BranchRealtimeEvent.WAITER_CALL:
      return { title: 'Guest needs assistance', body: 'Table requested staff' };
    default:
      return { title: 'Venue alert', body: envelope.event };
  }
}

function isFcmRetryable(code: string, message: string): boolean {
  if (
    code === 'messaging/unavailable' ||
    code === 'messaging/internal-error' ||
    code === 'messaging/quota-exceeded'
  ) {
    return true;
  }
  return (
    message.includes('UNAVAILABLE') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('ETIMEDOUT')
  );
}

/**
 * Firebase Cloud Messaging (HTTP v1) — first real `StaffPushProviderPort`.
 * Uses tenant-wide token fan-out from `StaffPushService.listTargetsForTenantDelivery`.
 *
 * **iOS:** Registration must use an **FCM registration token** (Firebase iOS SDK). Raw APNs
 * device tokens are not valid FCM targets — add an `ApnsStaffPushProvider` later for native APNs.
 */
@Injectable()
export class FcmStaffPushProviderService extends StaffPushProviderPort {
  private readonly logger = new Logger(FcmStaffPushProviderService.name);
  private readonly firebaseReady: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly staffPush: StaffPushService,
  ) {
    super();
    this.firebaseReady = this.tryInitFirebase();
  }

  private tryInitFirebase(): boolean {
    const json = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON')?.trim();
    if (!json) {
      this.logger.warn(
        JSON.stringify({
          msg: 'staff_push_fcm_missing_credentials',
          hint: 'Set FIREBASE_SERVICE_ACCOUNT_JSON when STAFF_PUSH_PROVIDER=fcm',
        }),
      );
      return false;
    }
    try {
      const raw = JSON.parse(json) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (!raw.project_id || !raw.client_email || !raw.private_key) {
        throw new Error('service_account_incomplete');
      }
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: raw.project_id,
            clientEmail: raw.client_email,
            privateKey: raw.private_key,
          }),
        });
      }
      this.logger.log(
        JSON.stringify({
          msg: 'staff_push_fcm_initialized',
          projectId: raw.project_id,
        }),
      );
      return true;
    } catch (e) {
      this.logger.error(
        JSON.stringify({
          msg: 'staff_push_fcm_init_failed',
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      return false;
    }
  }

  async deliver(
    envelope: StaffPushDeliveryEnvelope,
  ): Promise<StaffPushProviderDeliveryResult> {
    if (!this.firebaseReady) {
      return {
        outcome: 'failed',
        retryable: false,
        message: 'fcm_credentials_missing_or_invalid',
      };
    }

    const targets = await this.staffPush.listTargetsForTenantDelivery(
      envelope.tenantId,
    );
    if (targets.length === 0) {
      return { outcome: 'submitted' };
    }

    const { title, body } = staffPushNotificationCopy(envelope);
    const data = staffPushDataPayload(envelope);
    const dryRun = envFlagEnabled(
      this.config.get<string>('STAFF_PUSH_FCM_DRY_RUN'),
    );

    if (dryRun) {
      this.logger.log(
        JSON.stringify({
          msg: 'staff_push_fcm_dry_run',
          tenantId: envelope.tenantId,
          devices: targets.length,
          event: envelope.event,
        }),
      );
      return { outcome: 'submitted' };
    }

    const messages: admin.messaging.Message[] = targets.map((t) => ({
      token: t.token,
      notification: { title, body },
      data,
      android: { priority: 'high' },
    }));

    const batch = await getMessaging().sendEach(messages);
    const invalid: string[] = [];
    let anySuccess = false;
    let fatalMessage: string | null = null;
    let retryableMessage: string | null = null;

    batch.responses.forEach((resp, i) => {
      const token = targets[i]!.token;
      if (resp.success) {
        anySuccess = true;
        return;
      }
      const err = resp.error;
      const code = err?.code ?? '';
      const msg = err?.message ?? code;
      if (envFlagEnabled(this.config.get<string>('STAFF_PUSH_FCM_LOG_FAILURES'))) {
        this.logger.warn(
          JSON.stringify({
            msg: 'staff_push_fcm_send_failed',
            code,
            tokenSuffix: token.length > 8 ? token.slice(-8) : token,
          }),
        );
      }
      if (FCM_TOKEN_INVALID_CODES.has(code)) {
        invalid.push(token);
        return;
      }
      if (code === 'messaging/invalid-argument' && msg.includes('token')) {
        invalid.push(token);
        return;
      }
      if (isFcmRetryable(code, msg)) {
        retryableMessage = msg;
      } else {
        fatalMessage = msg;
      }
    });

    if (invalid.length > 0) {
      return {
        outcome: 'invalid_tokens',
        tokens: invalid,
        message: `fcm_invalid_tokens:${invalid.length}`,
      };
    }

    if (!anySuccess) {
      const msg =
        retryableMessage ?? fatalMessage ?? 'fcm_all_targets_failed_unknown';
      return {
        outcome: 'failed',
        retryable: retryableMessage != null,
        message: msg,
      };
    }

    if (retryableMessage || fatalMessage) {
      this.logger.warn(
        JSON.stringify({
          msg: 'staff_push_fcm_partial_failures_ignored',
          tenantId: envelope.tenantId,
          event: envelope.event,
          note: 'At least one device succeeded; see FCM batch responses for details',
        }),
      );
    }

    return { outcome: 'submitted' };
  }
}
