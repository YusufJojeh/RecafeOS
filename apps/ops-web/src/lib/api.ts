import {
  BranchRealtimeEvent,
  REALTIME_CONTRACT_VERSION,
  STAFF_HTTP_HEADER,
  staffAuthorizationBearer,
} from '@restocafe/types';

export { BranchRealtimeEvent, REALTIME_CONTRACT_VERSION, STAFF_HTTP_HEADER };
import type { StaffAuthRefreshResponse } from '@/lib/contract/auth-api';
import { useAuthStore } from './auth-store';

const base = import.meta.env.VITE_API_URL ?? '/api/v1';
const AUTH_REFRESH_PATH = '/auth/refresh';
const AUTH_SKIP_REFRESH_PATHS = new Set([
  '/auth/login',
  '/auth/accept-invite',
  AUTH_REFRESH_PATH,
  '/auth/logout',
]);
const SESSION_REASON_STORAGE_KEY = 'restocafe-session-reason';

/** Dispatched on `window` when refresh fails or tokens are cleared — listeners may route to sign-in. */
export const RESTOCAFE_SESSION_EXPIRED_EVENT = 'restocafe:session-expired';
/** Dispatched after a successful `/auth/refresh` — listeners may invalidate cached staff/tenant state. */
export const RESTOCAFE_SESSION_RESTORED_EVENT = 'restocafe:session-restored';

type RefreshResponse = StaffAuthRefreshResponse;

let refreshInFlight: Promise<boolean> | null = null;

/** Origin for Socket.IO (same host as the SPA in dev; absolute `VITE_API_URL` in prod). */
export function getSocketBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (raw && /^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).origin;
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:5173';
}

/** Thrown when `fetch` completes with a non-2xx status; includes HTTP status and parsed JSON when available. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

async function readErrorPayload(res: Response): Promise<{
  message: string;
  body: unknown;
}> {
  const text = await res.text();
  if (!text.trim()) {
    return { message: res.statusText || `HTTP ${res.status}`, body: undefined };
  }
  try {
    const json: unknown = JSON.parse(text);
    if (json && typeof json === 'object' && json !== null && 'message' in json) {
      const raw = (json as { message: unknown }).message;
      const message =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw)
            ? raw.map(String).join(', ')
            : text;
      return { message, body: json };
    }
    return { message: text, body: json };
  } catch {
    return { message: text, body: text };
  }
}

export function getToken(): string | null {
  return useAuthStore.getState().accessToken ?? localStorage.getItem('accessToken');
}

export function getBranchId(): string | null {
  return useAuthStore.getState().branchId ?? localStorage.getItem('branchId');
}

function getRefreshToken(): string | null {
  return useAuthStore.getState().refreshToken ?? localStorage.getItem('refreshToken');
}

function persistSessionReason(reason: 'expired'): void {
  try {
    localStorage.setItem(SESSION_REASON_STORAGE_KEY, reason);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(RESTOCAFE_SESSION_EXPIRED_EVENT, { detail: { reason } }),
    );
  }
}

function clearSessionReason(): void {
  try {
    localStorage.removeItem(SESSION_REASON_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function consumeSessionReason(): string | null {
  try {
    const reason = localStorage.getItem(SESSION_REASON_STORAGE_KEY);
    if (reason) {
      localStorage.removeItem(SESSION_REASON_STORAGE_KEY);
    }
    return reason;
  } catch {
    return null;
  }
}

function shouldSkipRefresh(path: string): boolean {
  return AUTH_SKIP_REFRESH_PATHS.has(path);
}

function markSessionExpired(): void {
  useAuthStore.getState().clear();
  persistSessionReason('expired');
}

/**
 * Exchanges the stored refresh token for a new access+refresh pair (rotation).
 * Used by `apiFetch` on 401 and by proactive session refresh before JWT expiry.
 */
export async function refreshAccessSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    markSessionExpired();
    return false;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${base}${AUTH_REFRESH_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          throw new Error(`refresh_failed_${res.status}`);
        }
        const payload = (await res.json()) as RefreshResponse;
        useAuthStore.getState().refreshSession({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          tenantId: payload.tenantId,
        });
        clearSessionReason();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(RESTOCAFE_SESSION_RESTORED_EVENT));
        }
        return true;
      } catch {
        markSessionExpired();
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

export async function restoreSession(): Promise<boolean> {
  return refreshAccessSession();
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

const NETWORK_RETRY_DELAY_MS = 450;

async function fetchWithOptionalNetworkRetry(
  url: string,
  init: RequestInit,
  allowIdempotentRetry: boolean,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (!allowIdempotentRetry || !isNetworkError(e)) {
      throw e;
    }
    await new Promise((r) => setTimeout(r, NETWORK_RETRY_DELAY_MS));
    return await fetch(url, init);
  }
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token && !headers.has(STAFF_HTTP_HEADER.AUTHORIZATION)) {
    headers.set(
      STAFF_HTTP_HEADER.AUTHORIZATION,
      staffAuthorizationBearer(token),
    );
  }
  const branchId = getBranchId();
  if (branchId && !headers.has(STAFF_HTTP_HEADER.BRANCH_ID)) {
    headers.set(STAFF_HTTP_HEADER.BRANCH_ID, branchId);
  }
  return headers;
}

/** Paths under `/api/v1` for branch-scoped ops (use with `apiFetch` and React Query keys that include `branchId`). */
export const branchPaths = {
  tables: (branchId: string) => `/branches/${branchId}/tables`,
  /** POST open table session (`OpenSessionDto`). */
  tableSessions: (branchId: string) => `/branches/${branchId}/tables/sessions`,
  /** POST merge sessions (`MergeSessionsDto`) — `TablesController.merge`. */
  tableSessionsMerge: (branchId: string) =>
    `/branches/${branchId}/tables/sessions/merge`,
  menuCategories: (branchId: string) => `/branches/${branchId}/menu/categories`,
  kitchenTickets: (branchId: string) =>
    `/branches/${branchId}/kitchen/tickets?station=KITCHEN`,
  barTickets: (branchId: string) => `/branches/${branchId}/bar/tickets`,
  kitchenTicket: (branchId: string, ticketId: string) =>
    `/branches/${branchId}/kitchen/tickets/${ticketId}`,
  barTicket: (branchId: string, ticketId: string) =>
    `/branches/${branchId}/bar/tickets/${ticketId}`,
  inventoryStock: (branchId: string) => `/branches/${branchId}/inventory/stock`,
  /** Optional `YYYY-MM-DD` in the branch calendar (server resolves via branch timezone). */
  reportsDaily: (branchId: string, date?: string) => {
    const path = `/branches/${branchId}/reports/daily`;
    if (!date?.trim()) return path;
    const q = new URLSearchParams({ date: date.trim() });
    return `${path}?${q.toString()}`;
  },
  reportsWeeklyDigest: (branchId: string) =>
    `/branches/${branchId}/reports/weekly-digest`,
  reportsDemandProfile: (branchId: string, days?: number) => {
    const path = `/branches/${branchId}/reports/demand-profile`;
    if (days == null) return path;
    const q = new URLSearchParams({ days: String(days) });
    return `${path}?${q.toString()}`;
  },
  openOrders: (branchId: string) => `/branches/${branchId}/orders`,
  orderDetail: (branchId: string, orderId: string) =>
    `/branches/${branchId}/orders/${orderId}`,
  orderServed: (branchId: string, orderId: string) =>
    `/branches/${branchId}/orders/${orderId}/served`,
  orderClose: (branchId: string, orderId: string) =>
    `/branches/${branchId}/orders/${orderId}/close`,
  onboardingStatus: (branchId: string) =>
    `/tenants/branches/${branchId}/onboarding-status`,
  configSnapshot: (branchId: string) =>
    `/tenants/branches/${branchId}/config-snapshot`,
  patchBranch: (branchId: string) => `/tenants/branches/${branchId}`,
  onboardingUi: (branchId: string) =>
    `/tenants/branches/${branchId}/onboarding-ui`,
  goLiveAck: (branchId: string) =>
    `/tenants/branches/${branchId}/go-live-ack`,
  menuImportDryRun: (branchId: string) =>
    `/branches/${branchId}/menu/import/dry-run`,
  menuImportApply: (branchId: string) =>
    `/branches/${branchId}/menu/import/apply`,
  setupReadiness: (branchId: string) =>
    `/tenants/branches/${branchId}/setup-readiness`,
  /** Setup + low-stock count + open shift (any branch member). */
  opsSnapshot: (branchId: string) =>
    `/tenants/branches/${branchId}/ops-snapshot`,
  /** Rolling 30d visit / repeat aggregates (branch-scoped; no PII). */
  customerVisitSignals: (branchId: string) =>
    `/branches/${branchId}/customers/visit-signals`,
  /** Customers who have visited this branch; optional `q` phone/name filter. */
  customersBranchSearch: (branchId: string, q?: string) => {
    const path = `/branches/${branchId}/customers/search`;
    if (!q?.trim()) return path;
    return `${path}?${new URLSearchParams({ q: q.trim() }).toString()}`;
  },
} as const;

/** Customer CRM-lite (tenant scope; requires customers.view / customers.manage). */
export const customerPaths = {
  search: (q?: string) => {
    const path = '/customers/search';
    if (!q?.trim()) return path;
    return `${path}?${new URLSearchParams({ q: q.trim() }).toString()}`;
  },
  detail: (id: string) => `/customers/${id}`,
  patch: (id: string) => `/customers/${id}`,
  addNote: (id: string) => `/customers/${id}/notes`,
  addOffer: (id: string) => `/customers/${id}/offers`,
} as const;

/** Tenant-level (no branch scope). */
export const tenantPaths = {
  /** POST register / GET list — JWT only; see StaffPushController. */
  pushDevices: () => '/tenants/push-devices',
  commerce: () => '/tenants/commerce',
  pilotFeedback: () => '/tenants/pilot-feedback',
  invites: () => '/tenants/invites',
  menuBranding: () => '/tenants/menu-branding',
  menuBrandingDraft: () => '/tenants/menu-branding/draft',
  menuBrandingPublish: () => '/tenants/menu-branding/publish',
  menuBrandingLogo: () => '/tenants/menu-branding/logo',
  menuBrandingDraftLogo: () => '/tenants/menu-branding/draft-logo',
  menuBrandingAnalyze: () => '/tenants/menu-branding/analyze-logo',
  menuBrandingApplyAnalysis: () => '/tenants/menu-branding/apply-analysis',
  /** Omit dates to use API default (last 7 UTC days). */
  tenantRollup: (from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (from?.trim()) p.set('from', from.trim());
    if (to?.trim()) p.set('to', to.trim());
    const q = p.toString();
    return `/tenants/reports/tenant-rollup${q ? `?${q}` : ''}`;
  },
  branchSnapshot: (date: string) => {
    const q = new URLSearchParams({ date: date.trim() });
    return `/tenants/reports/branch-snapshot?${q.toString()}`;
  },
  repeatCustomers: (days?: number) => {
    const path = '/tenants/reports/repeat-customers';
    if (days == null) return path;
    return `${path}?${new URLSearchParams({ days: String(days) }).toString()}`;
  },
  /** Deletes visit rows older than `years` (default 7); requires reports.tenant_rollups. */
  archiveStaleCustomerVisits: (years?: number) => {
    const path = '/tenants/reports/archive-stale-customer-visits';
    if (years == null) return path;
    return `${path}?${new URLSearchParams({ years: String(years) }).toString()}`;
  },
} as const;

export async function uploadMenuBrandingLogo(file: File): Promise<{ logoDraftKey: string }> {
  const form = new FormData();
  form.append('file', file);
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers[STAFF_HTTP_HEADER.AUTHORIZATION] = staffAuthorizationBearer(token);
  }
  let res = await fetch(`${base}${tenantPaths.menuBrandingLogo()}`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (res.status === 401 && getRefreshToken() && !shouldSkipRefresh(tenantPaths.menuBrandingLogo())) {
    const refreshed = await refreshAccessSession();
    if (refreshed) {
      const t2 = getToken();
      const h2: Record<string, string> = {};
      if (t2) {
        h2[STAFF_HTTP_HEADER.AUTHORIZATION] = staffAuthorizationBearer(t2);
      }
      res = await fetch(`${base}${tenantPaths.menuBrandingLogo()}`, {
        method: 'POST',
        headers: h2,
        body: form,
      });
    }
  }
  if (!res.ok) {
    const { message, body } = await readErrorPayload(res);
    throw new ApiError(message, res.status, body);
  }
  return (await res.json()) as { logoDraftKey: string };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const allowNetworkRetry =
    method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  let headers = buildHeaders(init);
  let res: Response = await fetchWithOptionalNetworkRetry(
    `${base}${path}`,
    { ...init, headers },
    allowNetworkRetry,
  );

  // Refresh using the refresh token even when access is missing (expired/cleared);
  // relying only on getToken() would skip recovery for edge cases after partial state loss.
  if (res.status === 401 && getRefreshToken() && !shouldSkipRefresh(path)) {
    const refreshed = await refreshAccessSession();
    if (refreshed) {
      headers = buildHeaders(init);
      res = await fetchWithOptionalNetworkRetry(
        `${base}${path}`,
        { ...init, headers },
        allowNetworkRetry,
      );
    }
  }

  if (!res.ok) {
    const { message, body } = await readErrorPayload(res);
    throw new ApiError(message, res.status, body);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
