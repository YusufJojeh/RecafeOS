import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellRing,
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  RefreshCcw,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { STAFF_HTTP_HEADER } from '@restocafe/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/i18n/context';
import { describeApiError } from '../lib/api-error-copy';
import {
  publicMenuHeaderTitle,
  resolveMenuLogoUrl,
  resolvePublicMenuTheme,
  themeToCssVars,
} from '../lib/public-menu-theme';
import {
  publicGuestPaths,
  type PublicGuestCreateOrderBody,
  type PublicGuestMenuItem,
  type PublicGuestMenuResponse,
  type PublicGuestModifierGroup,
  type PublicGuestOrderStatusPayload,
  type PublicGuestOrderSummary,
} from '../lib/contract/public-guest-api';

/** Scoped keyframes — no extra dependencies. */
const PREMIUM_MENU_CSS = `
@keyframes pm-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes pm-slide-up { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
@keyframes pm-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes pm-scale-in { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
.pm-scale-in { animation: pm-scale-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
.pm-pad-bottom { padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px)); }
.pm-pad-bottom-cart { padding-bottom: calc(7.25rem + env(safe-area-inset-bottom, 0px)); }
.pm-toast-above-cart { bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px)); }
@keyframes pm-shimmer { 100% { transform: translateX(100%); } }
@keyframes pm-check-pop { 0% { transform: scale(0.5); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
.pm-backdrop-enter { animation: pm-fade-in 0.28s ease-out forwards; }
.pm-modal-sheet { animation: pm-sheet-up 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
@media (min-width: 640px) {
  .pm-modal-sheet { animation: pm-scale-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards; transform: none !important; }
}
.pm-card-enter { animation: pm-slide-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
.pm-check-icon { animation: pm-check-pop 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.pm-shimmer-wrap { position: relative; overflow: hidden; }
.pm-shimmer-wrap::after {
  content: "";
  position: absolute; inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
  animation: pm-shimmer 1.4s ease-in-out infinite;
}
.pm-root { font-family: var(--pm-font, ui-sans-serif, system-ui, sans-serif); }
.pm-mesh-bg { background: var(--pm-mesh); }
.pm-header-surface {
  border: 1px solid var(--pm-header-border);
  background: var(--pm-header-bg);
  box-shadow: 0 8px 32px rgba(15,23,42,0.06);
  backdrop-filter: blur(16px);
}
.pm-section-surface {
  border: 1px solid var(--pm-border);
  background: var(--pm-card);
  box-shadow: var(--pm-card-shadow);
  backdrop-filter: var(--pm-card-backdrop);
}
.pm-item-surface {
  border: 1px solid var(--pm-border);
  background: var(--pm-card-inner);
}
.pm-item-surface:not(.pm-item-disabled):hover {
  border-color: rgba(var(--pm-primary-rgb), 0.35);
  background: var(--pm-card);
  box-shadow: 0 10px 28px rgba(var(--pm-primary-rgb), 0.12);
}
.pm-badge-pill {
  border: 1px solid var(--pm-badge-border);
  background: var(--pm-badge-bg);
  color: var(--pm-badge-text);
}
.pm-gradient-btn {
  background: linear-gradient(to right, var(--pm-primary), var(--pm-accent));
  color: #fff;
  border-radius: var(--pm-btn-radius);
  box-shadow: 0 8px 24px rgba(var(--pm-primary-rgb), 0.28);
}
.pm-cta-solid {
  background: var(--pm-cta-bg);
  color: var(--pm-cta-fg);
}
.pm-text-primary { color: var(--pm-text); }
.pm-text-muted { color: var(--pm-muted); }
.pm-layout-compact .pm-header-surface { padding: 1rem !important; }
.pm-layout-featured_hero .pm-header-surface { padding: 1.75rem !important; }
`;

class PublicApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
}

const apiBase = () => import.meta.env.VITE_API_URL ?? '/api/v1';

type CartLine = {
  lineId: string;
  menuItemId: string;
  name: string;
  basePriceMinor: number;
  quantity: number;
  modifierOptionIds: string[];
  extrasLabel: string;
  unitTotalMinor: number;
};

function fetchPublicMenu(tenantSlug: string, branchSlug: string, token: string) {
  return fetch(`${apiBase()}${publicGuestPaths.sessionMenu(tenantSlug, branchSlug, token)}`).then(
    async (res) => {
      if (!res.ok) {
        if (res.status === 404) {
          throw new PublicApiError('This menu session is no longer available.', 404);
        }
        if (res.status === 429) {
          throw new PublicApiError('Menu requests are being throttled. Please retry in a moment.', 429);
        }
        throw new PublicApiError('Menu is unavailable right now. Try again shortly.', res.status);
      }
      return (await res.json()) as PublicGuestMenuResponse;
    },
  );
}

function assertModifierOk(groups: PublicGuestModifierGroup[], selected: Set<string>): string | null {
  for (const g of groups) {
    const picked = g.options.filter((o) => selected.has(o.id));
    const n = picked.length;
    if (n < g.minSelect) return 'min_modifiers';
    if (g.maxSelect > 0 && n > g.maxSelect) return 'max_modifiers';
    if (g.required && n < 1) return 'required_modifiers';
  }
  const allowed = new Set(groups.flatMap((g) => g.options.map((o) => o.id)));
  for (const id of selected) {
    if (!allowed.has(id)) return 'invalid_modifiers';
  }
  return null;
}

function unitTotalMinor(
  base: number,
  groups: PublicGuestModifierGroup[],
  selected: Set<string>,
): number {
  let u = base;
  for (const g of groups) {
    for (const o of g.options) {
      if (selected.has(o.id)) u += o.priceDelta;
    }
  }
  return u;
}

function formatMoney(minor: number) {
  return (minor / 100).toFixed(2);
}

export function PublicMenuPage() {
  const { t, dir } = useLanguage();
  const { tenantSlug, branchSlug, token } = useParams();
  const hasValidParams = Boolean(tenantSlug && branchSlug && token);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartExpanded, setCartExpanded] = useState(false);
  const [configureItem, setConfigureItem] = useState<PublicGuestMenuItem | null>(null);
  const [selectedMods, setSelectedMods] = useState<Set<string>>(() => new Set());
  const [modErr, setModErr] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PublicGuestOrderSummary | null>(null);
  const idempotencyRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    idempotencyRef.current = null;
  }, [cart]);

  useEffect(() => {
    if (!configureItem) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [configureItem]);

  const menu = useQuery({
    queryKey: ['public-menu', tenantSlug, branchSlug, token],
    queryFn: async () => {
      if (!tenantSlug || !branchSlug || !token) {
        throw new Error('Invalid menu link');
      }
      return fetchPublicMenu(tenantSlug, branchSlug, token);
    },
    enabled: hasValidParams,
  });

  const call = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error('Invalid session link');
      }
      const res = await fetch(`${apiBase()}/public/sessions/${token}/call-waiter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t.publicMenu.callAssistanceMessage }),
      });
      if (!res.ok) {
        if (res.status === 404) {
          throw new PublicApiError('This table session is no longer active.', 404);
        }
        if (res.status === 400) {
          throw new PublicApiError('Staff assistance is disabled for this table session.', 400);
        }
        if (res.status === 429) {
          throw new PublicApiError('Please wait before sending another staff request.', 429);
        }
        throw new PublicApiError('Could not notify staff. Try again.', res.status);
      }
    },
  });

  const placeOrder = useMutation({
    mutationFn: async (): Promise<PublicGuestOrderSummary> => {
      if (!tenantSlug || !branchSlug || !token) {
        throw new Error('Invalid session link');
      }
      if (cart.length === 0) {
        throw new Error('empty');
      }
      if (!idempotencyRef.current) {
        idempotencyRef.current =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `guest-${Date.now()}`;
      }
      const idem = idempotencyRef.current;
      const body: PublicGuestCreateOrderBody = {
        items: cart.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          modifierOptionIds: l.modifierOptionIds.length ? l.modifierOptionIds : undefined,
        })),
      };
      const res = await fetch(
        `${apiBase()}${publicGuestPaths.sessionOrder(tenantSlug, branchSlug, token)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [STAFF_HTTP_HEADER.IDEMPOTENCY_KEY]: idem,
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try {
          const j = JSON.parse(text) as { message?: string | string[] };
          if (Array.isArray(j.message)) msg = j.message.join(', ');
          else if (typeof j.message === 'string') msg = j.message;
        } catch {
          /* ignore */
        }
        throw new PublicApiError(msg || 'Order failed', res.status);
      }
      return (await res.json()) as PublicGuestOrderSummary;
    },
    onSuccess: (data) => {
      setPlacedOrder(data);
      setCart([]);
      setCartExpanded(false);
    },
  });

  useEffect(() => {
    if (!placeOrder.isError) return;
    const id = window.setTimeout(() => {
      placeOrder.reset();
    }, 10000);
    return () => window.clearTimeout(id);
  }, [placeOrder.isError, placeOrder]);

  const orderStatus = useQuery({
    queryKey: [
      'public-order-status',
      tenantSlug,
      branchSlug,
      token,
      placedOrder?.orderId,
    ],
    queryFn: async () => {
      if (!tenantSlug || !branchSlug || !token || !placedOrder?.orderId) {
        throw new Error('missing');
      }
      const res = await fetch(
        `${apiBase()}${publicGuestPaths.sessionOrderStatus(
          tenantSlug,
          branchSlug,
          token,
          placedOrder.orderId,
        )}`,
      );
      if (!res.ok) {
        throw new PublicApiError('Status failed', res.status);
      }
      return (await res.json()) as PublicGuestOrderStatusPayload;
    },
    enabled: Boolean(placedOrder?.orderId && hasValidParams),
    refetchInterval: (q) => {
      const s = q.state.data?.customerStatus;
      if (s === 'done' || s === 'cancelled') return false;
      return 5_000;
    },
  });

  const cartTotalMinor = useMemo(
    () => cart.reduce((s, l) => s + l.unitTotalMinor * l.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);

  const openConfigure = useCallback((item: PublicGuestMenuItem) => {
    const groups = item.modifierGroups.map((x) => x.modifierGroup);
    if (groups.length === 0) {
      const unit = item.priceMinor;
      const lineId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `l-${Date.now()}`;
      setCart((prev) => [
        ...prev,
        {
          lineId,
          menuItemId: item.id,
          name: item.name,
          basePriceMinor: item.priceMinor,
          quantity: 1,
          modifierOptionIds: [],
          extrasLabel: '',
          unitTotalMinor: unit,
        },
      ]);
      setCartExpanded(true);
      return;
    }
    setConfigureItem(item);
    setSelectedMods(new Set());
    setModErr(false);
  }, []);

  const confirmConfigure = useCallback(() => {
    if (!configureItem) return;
    const groups = configureItem.modifierGroups.map((x) => x.modifierGroup);
    const err = assertModifierOk(groups, selectedMods);
    if (err) {
      setModErr(true);
      return;
    }
    setModErr(false);
    const unit = unitTotalMinor(configureItem.priceMinor, groups, selectedMods);
    const ids = [...selectedMods];
    const labels: string[] = [];
    for (const g of groups) {
      for (const o of g.options) {
        if (selectedMods.has(o.id)) labels.push(o.name);
      }
    }
    const lineId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `l-${Date.now()}`;
    setCart((prev) => [
      ...prev,
      {
        lineId,
        menuItemId: configureItem.id,
        name: configureItem.name,
        basePriceMinor: configureItem.priceMinor,
        quantity: 1,
        modifierOptionIds: ids,
        extrasLabel: labels.join(', '),
        unitTotalMinor: unit,
      },
    ]);
    setConfigureItem(null);
    setSelectedMods(new Set());
    setModErr(false);
    setCartExpanded(true);
  }, [configureItem, selectedMods]);

  const toggleMod = useCallback(
    (g: PublicGuestModifierGroup, optionId: string) => {
      setSelectedMods((prev) => {
        const next = new Set(prev);
        const on = next.has(optionId);
        if (on) {
          next.delete(optionId);
          return next;
        }
        if (g.maxSelect === 1) {
          for (const o of g.options) {
            next.delete(o.id);
          }
          next.add(optionId);
          return next;
        }
        const picked = g.options.filter((o) => next.has(o.id));
        if (g.maxSelect > 0 && picked.length >= g.maxSelect) {
          return prev;
        }
        next.add(optionId);
        return next;
      });
    },
    [],
  );

  const updateLineQty = useCallback((lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.lineId !== lineId) return l;
          const q = l.quantity + delta;
          if (q < 1) return null;
          return { ...l, quantity: q };
        })
        .filter(Boolean) as CartLine[],
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const itemCount =
    menu.data?.categories.reduce((count, category) => count + category.items.length, 0) ?? 0;

  const startNewOrder = useCallback(() => {
    setPlacedOrder(null);
    idempotencyRef.current = null;
    queryClient.removeQueries({ queryKey: ['public-order-status'] });
  }, [queryClient]);

  const modalPreviewTotal = useMemo(() => {
    if (!configureItem) return 0;
    return unitTotalMinor(
      configureItem.priceMinor,
      configureItem.modifierGroups.map((x) => x.modifierGroup),
      selectedMods,
    );
  }, [configureItem, selectedMods]);

  const safeBottom = 'max(env(safe-area-inset-bottom, 0px), 12px)';

  const activeTheme = useMemo(
    () => resolvePublicMenuTheme(menu.data?.branding ?? null),
    [menu.data?.branding],
  );
  const cssVars = useMemo(() => themeToCssVars(activeTheme), [activeTheme]);
  const logoSrc = useMemo(
    () => resolveMenuLogoUrl(menu.data?.branding?.logoUrl ?? null, apiBase()),
    [menu.data?.branding?.logoUrl],
  );
  const headerTitle = useMemo(
    () =>
      publicMenuHeaderTitle(
        activeTheme,
        menu.data?.branch.name ?? t.publicMenu.titleFallback,
      ),
    [activeTheme, menu.data?.branch.name, t.publicMenu.titleFallback],
  );

  if (placedOrder) {
    const live = orderStatus.data;
    const statusLabel =
      live?.customerStatus === 'preparing'
        ? t.publicMenu.statusPreparing
        : live?.customerStatus === 'ready'
          ? t.publicMenu.statusReady
          : live?.customerStatus === 'done'
            ? t.publicMenu.statusDone
            : live?.customerStatus === 'cancelled'
              ? t.publicMenu.statusCancelled
              : t.publicMenu.statusPending;

    return (
      <div dir={dir} className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-50">
        <style dangerouslySetInnerHTML={{ __html: PREMIUM_MENU_CSS }} />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(16,185,129,0.35),transparent_50%),radial-gradient(ellipse_80%_50%_at_100%_100%,rgba(59,130,246,0.12),transparent)]"
          aria-hidden
        />
        <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10 sm:px-6">
          <div className="pm-scale-in rounded-[2rem] border border-white/10 bg-white/[0.07] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="pm-check-icon mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-[0_12px_40px_rgba(16,185,129,0.45)]">
              <Check className="h-10 w-10 stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400/90">
              {t.publicMenu.badge}
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {t.publicMenu.orderReceived}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">{t.publicMenu.orderRefLabel}</p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.2em] text-emerald-400">
              {placedOrder.orderRef}
            </p>
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5 text-start">
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {t.publicMenu.orderStatusLabel}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-lg font-medium text-white">{statusLabel}</span>
                {orderStatus.isFetching ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                ) : null}
              </div>
              {orderStatus.isFetching ? (
                <p className="mt-2 text-xs text-zinc-500">{t.publicMenu.statusRefreshing}</p>
              ) : null}
            </div>
            <div className="mt-6 flex items-baseline justify-center gap-2 border-t border-white/10 pt-6">
              <span className="text-sm text-zinc-500">{t.publicMenu.orderTotalHint}</span>
              <span className="text-2xl font-semibold tabular-nums text-white">
                {formatMoney(placedOrder.totalMinor)}
              </span>
            </div>
            <button
              type="button"
              className="mt-8 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-4 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(16,185,129,0.35)] transition hover:brightness-110 active:scale-[0.98]"
              onClick={() => startNewOrder()}
            >
              {t.publicMenu.orderAgain}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const layoutClass =
    activeTheme.menuLayout === 'compact'
      ? 'pm-layout-compact'
      : activeTheme.menuLayout === 'featured_hero'
        ? 'pm-layout-featured_hero'
        : '';

  return (
    <div
      dir={dir}
      data-pm-layout={activeTheme.menuLayout}
      style={cssVars}
      className={`pm-root relative min-h-screen bg-[var(--pm-page)] text-[var(--pm-text)] antialiased ${
        cart.length > 0 ? 'pm-pad-bottom-cart' : 'pm-pad-bottom'
      } ${layoutClass}`}
    >
      <style dangerouslySetInnerHTML={{ __html: PREMIUM_MENU_CSS }} />

      <div className="pm-mesh-bg pointer-events-none fixed inset-0" aria-hidden />

      <div className="relative mx-auto max-w-2xl px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:max-w-5xl sm:px-6 sm:pt-8">
        <header className="pm-slide-up pm-header-surface sticky top-[max(0.5rem,env(safe-area-inset-top))] z-20 mb-5 rounded-3xl p-5 sm:mb-8 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="pm-badge-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]">
                {t.publicMenu.badge}
              </div>
              {logoSrc ? (
                <div className="flex items-center gap-3">
                  <img
                    src={logoSrc}
                    alt=""
                    className="h-12 w-auto max-w-[200px] object-contain object-left"
                  />
                </div>
              ) : null}
              <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-4xl sm:tracking-tight">
                {headerTitle}
              </h1>
              <p className="max-w-xl text-pretty text-sm leading-relaxed sm:text-[15px] pm-text-muted">
                {t.publicMenu.helper}
              </p>
            </div>
            <button
              type="button"
              className="pm-cta-solid inline-flex h-12 shrink-0 items-center justify-center gap-2 self-stretch rounded-2xl px-5 text-sm font-semibold shadow-lg transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 sm:self-auto sm:rounded-full"
              onClick={() => call.mutate()}
              disabled={call.isPending || !hasValidParams}
            >
              <BellRing className="h-4 w-4 opacity-90" />
              <span>
                {call.isSuccess
                  ? t.publicMenu.called
                  : call.isPending
                    ? t.publicMenu.calling
                    : t.publicMenu.callWaiter}
              </span>
            </button>
          </div>

          {!hasValidParams ? (
            <div
              className="mt-4 flex gap-3 rounded-2xl border border-red-200/80 bg-red-50/90 p-4 text-sm text-red-800"
              role="alert"
            >
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
              {t.publicMenu.invalidLink}
            </div>
          ) : null}

          {call.isError ? (
            <div
              className="mt-4 flex gap-3 rounded-2xl border border-red-200/80 bg-red-50/90 p-4 text-sm text-red-800"
              role="alert"
            >
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
              {describeApiError(call.error, {
                fallback: t.publicMenu.notifyFailed,
                byStatus: {
                  400: t.publicMenu.callDisabled,
                  404: t.publicMenu.sessionInactive,
                  429: t.publicMenu.callThrottled,
                  500: t.publicMenu.notifyServerFailed,
                },
              })}
            </div>
          ) : null}
        </header>

        {menu.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="pm-shimmer-wrap overflow-hidden rounded-3xl border border-zinc-200/80 bg-zinc-100/80"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex gap-4 p-4">
                  <div className="pm-shimmer-wrap h-24 w-24 shrink-0 rounded-2xl bg-zinc-200/60" />
                  <div className="flex flex-1 flex-col justify-center gap-2">
                    <div className="pm-shimmer-wrap h-4 w-3/5 max-w-[12rem] rounded-md bg-zinc-200/70" />
                    <div className="pm-shimmer-wrap h-3 w-full rounded-md bg-zinc-200/50" />
                    <div className="pm-shimmer-wrap mt-2 h-3 w-1/4 rounded-md bg-zinc-200/60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {menu.isError ? (
          <div
            className="pm-fade-in rounded-3xl border border-red-200/60 bg-white p-8 text-center shadow-xl"
            role="alert"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <RefreshCcw className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">{t.publicMenu.unavailable}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-600">
              {describeApiError(menu.error, {
                fallback: t.publicMenu.menuUnavailable,
                byStatus: {
                  404: t.publicMenu.menuSessionUnavailable,
                  429: t.publicMenu.menuThrottled,
                  500: t.publicMenu.menuServerFailed,
                },
              })}
            </p>
            <button
              type="button"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-zinc-50 px-6 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 active:scale-[0.98]"
              onClick={() => void menu.refetch()}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.publicMenu.retry}
            </button>
          </div>
        ) : null}

        {!menu.isLoading && !menu.isError && menu.data && itemCount === 0 ? (
          <div className="rounded-3xl border border-zinc-200/80 bg-white/90 p-10 text-center text-sm text-zinc-600 shadow-sm">
            {t.publicMenu.empty}
          </div>
        ) : null}

        <div className="space-y-8 sm:space-y-10">
          {menu.data?.categories.map((category, ci) => (
            <section
              key={category.name}
              className="pm-card-enter pm-section-surface rounded-[1.75rem] p-5 sm:p-7"
              style={{ animationDelay: `${ci * 70}ms` }}
            >
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--pm-border)] pb-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] pm-text-muted">
                  {category.name}
                </h2>
                <span className="rounded-full px-3 py-1 text-xs font-medium pm-text-muted bg-[var(--pm-card-inner)]">
                  {t.publicMenu.itemsCount.replace('{count}', String(category.items.length))}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {category.items.map((item, ii) => {
                  const unavailable = !item.available || !item.visible;
                  return (
                    <article
                      key={item.id}
                      className={`group pm-card-enter pm-item-surface flex flex-col overflow-hidden rounded-2xl transition duration-300 sm:flex-row ${
                        unavailable ? 'pm-item-disabled opacity-45 grayscale' : 'hover:-translate-y-0.5'
                      }`}
                      style={{ animationDelay: `${(ci * 5 + ii) * 40}ms` }}
                    >
                      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[var(--pm-card-inner)] sm:aspect-auto sm:h-36 sm:w-36">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full min-h-[8rem] items-center justify-center bg-[var(--pm-card-inner)] sm:min-h-0">
                            <ShoppingBag className="h-10 w-10 opacity-40 pm-text-muted" />
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
                        <div>
                          <div className="font-semibold leading-snug pm-text-primary">{item.name}</div>
                          {item.description ? (
                            <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed pm-text-muted">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-lg font-semibold tabular-nums pm-text-primary">
                            {formatMoney(item.priceMinor)}
                          </span>
                          <button
                            type="button"
                            disabled={unavailable}
                            onClick={() => openConfigure(item)}
                            className="pm-gradient-btn px-5 py-2.5 text-xs font-bold uppercase tracking-wide transition hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:from-zinc-300 disabled:to-zinc-300 disabled:bg-zinc-300 disabled:shadow-none"
                          >
                            {unavailable ? t.publicMenu.unavailableItem : t.publicMenu.addToCart}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {configureItem ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pm-modal-title"
        >
          <button
            type="button"
            className="pm-backdrop-enter absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            aria-label={t.publicMenu.closeModal}
            onClick={() => {
              setConfigureItem(null);
              setSelectedMods(new Set());
              setModErr(false);
            }}
          />
          <div className="pm-modal-sheet relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-white/20 bg-white shadow-[0_-12px_48px_rgba(0,0,0,0.2)] sm:max-h-[85vh] sm:rounded-3xl sm:shadow-2xl">
            <div className="relative max-h-40 shrink-0 overflow-hidden bg-zinc-100 sm:max-h-48">
              {configureItem.imageUrl ? (
                <img
                  src={configureItem.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-36 items-center justify-center sm:h-44"
                  style={{
                    background: `linear-gradient(to bottom right, rgba(var(--pm-primary-rgb),0.12), rgba(var(--pm-accent-rgb),0.18))`,
                  }}
                >
                  <ShoppingBag
                    className="h-14 w-14 opacity-50"
                    style={{ color: 'var(--pm-primary)' }}
                  />
                </div>
              )}
              <button
                type="button"
                className="absolute end-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/55"
                onClick={() => {
                  setConfigureItem(null);
                  setSelectedMods(new Set());
                  setModErr(false);
                }}
                aria-label={t.publicMenu.closeModal}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-5">
              <h3 id="pm-modal-title" className="text-xl font-semibold pm-text-primary">
                {configureItem.name}
              </h3>
              <p className="mt-1 text-sm pm-text-muted">
                {t.publicMenu.cartTotal}{' '}
                <span className="font-semibold tabular-nums pm-text-primary">
                  {formatMoney(configureItem.priceMinor)}
                </span>
              </p>
              {configureItem.description ? (
                <p className="mt-3 text-sm leading-relaxed pm-text-muted">{configureItem.description}</p>
              ) : null}
              <div className="mt-6 space-y-6">
                {configureItem.modifierGroups.map(({ modifierGroup: g }) => (
                  <div key={g.id}>
                    <div className="text-sm font-semibold pm-text-primary">
                      {g.name}
                      {g.required ? (
                        <span className="ms-1 text-red-600" aria-hidden>
                          *
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2">
                      {g.options.map((o) => {
                        const checked = selectedMods.has(o.id);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => toggleMod(g, o.id)}
                            className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-start transition duration-200 active:scale-[0.99] ${
                              checked
                                ? 'shadow-[0_0_0_1px_rgba(var(--pm-primary-rgb),0.25)]'
                                : 'border-[var(--pm-border)] bg-[var(--pm-card-inner)] hover:border-[var(--pm-border)] hover:bg-[var(--pm-card)]'
                            }`}
                            style={
                              checked
                                ? {
                                    borderColor: 'var(--pm-primary)',
                                    background: `rgba(var(--pm-primary-rgb),0.08)`,
                                  }
                                : undefined
                            }
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                checked ? 'text-white' : 'border-[var(--pm-border)] bg-[var(--pm-card)]'
                              }`}
                              style={
                                checked
                                  ? {
                                      borderColor: 'var(--pm-primary)',
                                      background: 'var(--pm-primary)',
                                    }
                                  : undefined
                              }
                              aria-hidden
                            >
                              {checked ? (
                                <Check className="h-3 w-3 text-white" strokeWidth={3} />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-medium pm-text-primary">
                              {o.name}
                            </span>
                            {o.priceDelta ? (
                              <span className="shrink-0 text-xs font-medium tabular-nums pm-text-muted">
                                +{formatMoney(o.priceDelta)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {modErr ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {t.publicMenu.modifierInvalid}
                </p>
              ) : null}
            </div>
            <div className="border-t border-[var(--pm-border)] bg-[var(--pm-card)] p-4 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="pm-text-muted">{t.publicMenu.cartTotal}</span>
                <span className="text-lg font-bold tabular-nums pm-text-primary">
                  {formatMoney(modalPreviewTotal)}
                </span>
              </div>
              <button
                type="button"
                className="pm-gradient-btn w-full py-4 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 active:scale-[0.99]"
                onClick={() => confirmConfigure()}
              >
                {t.publicMenu.addToCart}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cart.length > 0 ? (
        <div
          className="fixed inset-x-0 bottom-0 z-50 px-3 sm:px-6"
          style={{ paddingBottom: safeBottom }}
        >
          <div
            className="mx-auto max-w-lg overflow-hidden rounded-t-[1.75rem] border shadow-[0_-16px_48px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:max-w-2xl sm:rounded-3xl sm:border"
            style={{
              borderColor: 'var(--pm-border)',
              background: 'var(--pm-card)',
            }}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start transition hover:opacity-95 sm:px-5"
              onClick={() => setCartExpanded((e) => !e)}
              aria-expanded={cartExpanded}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="pm-gradient-btn relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md">
                  <ShoppingBag className="h-5 w-5" />
                  <span className="pm-cta-solid absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold">
                    {cartCount}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold pm-text-primary">{t.publicMenu.cartYourOrder}</div>
                  <div className="truncate text-xs pm-text-muted">
                    {cartExpanded
                      ? t.publicMenu.cartTapCollapse
                      : t.publicMenu.cartCollapsedHint
                          .replace('{count}', String(cartCount))
                          .replace('{total}', formatMoney(cartTotalMinor))}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-base font-bold tabular-nums pm-text-primary">
                  {formatMoney(cartTotalMinor)}
                </span>
                {cartExpanded ? (
                  <ChevronDown className="h-5 w-5 pm-text-muted opacity-70" />
                ) : (
                  <ChevronUp className="h-5 w-5 pm-text-muted opacity-70" />
                )}
              </div>
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                cartExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="max-h-48 space-y-1 overflow-y-auto overscroll-contain border-t border-[var(--pm-border)] px-4 py-3 sm:max-h-56">
                  {cart.map((l) => (
                    <div
                      key={l.lineId}
                      className="flex items-center gap-2 rounded-xl px-2 py-2.5"
                      style={{ background: 'var(--pm-card-inner)' }}
                    >
                      <div className="min-w-0 flex-1 ps-1">
                        <div className="truncate text-sm font-medium pm-text-primary">{l.name}</div>
                        {l.extrasLabel ? (
                          <div className="truncate text-xs pm-text-muted">{l.extrasLabel}</div>
                        ) : null}
                        <div className="mt-0.5 text-xs font-medium tabular-nums pm-text-muted">
                          {formatMoney(l.unitTotalMinor * l.quantity)}
                        </div>
                      </div>
                      <div
                        className="flex shrink-0 items-center gap-0.5 rounded-full border border-zinc-200/80 bg-white p-1 shadow-sm"
                        dir="ltr"
                      >
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-700 transition hover:bg-zinc-100 active:scale-90"
                          onClick={() => updateLineQty(l.lineId, -1)}
                          aria-label="-"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
                          {l.quantity}
                        </span>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-700 transition hover:bg-zinc-100 active:scale-90"
                          onClick={() => updateLineQty(l.lineId, 1)}
                          aria-label="+"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-600 transition hover:bg-red-50"
                        onClick={() => removeLine(l.lineId)}
                        aria-label="remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--pm-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="hidden text-sm pm-text-muted sm:block">{t.publicMenu.cartTotal}</div>
              <button
                type="button"
                disabled={placeOrder.isPending || cartCount === 0}
                onClick={() => placeOrder.mutate()}
                className="pm-cta-solid w-full rounded-2xl py-4 text-sm font-bold uppercase tracking-wide shadow-lg transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[200px] sm:py-3.5"
              >
                {placeOrder.isPending ? t.publicMenu.placingOrder : t.publicMenu.placeOrder}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {placeOrder.isError ? (
        <div
          className="pm-toast-above-cart fixed inset-x-4 z-60 mx-auto max-w-lg sm:inset-x-auto sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          role="alert"
        >
          <div className="pm-slide-up rounded-2xl border border-red-200/80 bg-white p-4 shadow-2xl ring-1 ring-red-500/10">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <X className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{t.publicMenu.orderFailed}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                  {describeApiError(placeOrder.error, {
                    fallback: t.publicMenu.orderFailed,
                    byStatus: {
                      400: t.publicMenu.orderBadRequest,
                      403: t.publicMenu.orderDisabled,
                      429: t.publicMenu.orderThrottled,
                      503: t.publicMenu.orderRetry,
                    },
                  })}
                </p>
                <button
                  type="button"
                  className="mt-3 text-sm font-semibold underline-offset-2 hover:underline"
                  style={{ color: 'var(--pm-primary)' }}
                  onClick={() => placeOrder.reset()}
                >
                  {t.publicMenu.dismiss}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
