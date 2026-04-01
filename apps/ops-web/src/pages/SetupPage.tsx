import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MetricCard, PageFrame, PageHeader, StatePanel } from '../components/ConsoleUi';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/context';
import { ApiError, apiFetch, branchPaths, tenantPaths } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';
import {
  buildOnboardingChecklistCsv,
  resolveOnboardingStepCopy,
} from '../lib/onboarding-step-copy';
import { useBranchId } from '../lib/use-branch-id';

type OnboardingStepDetail = {
  id: string;
  label: string;
  done: boolean;
  tier: 'blocking' | 'recommended';
  why: string;
  nextPath: string;
  snoozedUntil?: string | null;
  dismissed?: boolean;
};

type OnboardingStatus = {
  branchSlug: string;
  tenantSlug: string;
  publicMenuUrlTemplate: string | null;
  appPublicUrlConfigured: boolean;
  steps: OnboardingStepDetail[];
  progressPercent: number;
  blockingIncompleteCount: number;
  readyForGoLive: boolean;
  goLiveAcknowledgedAt: string | null;
};

type CommerceReadModel = {
  subscriptionPlan: string;
  billingStatus: string;
  trialEndsAt: string | null;
  maxBranches: number;
  branchesInUse: number;
  maxUsers: number;
  usersInUse: number;
  /** Total menu line items across branches — bulk-import trigger aligns with docs/growth/RETENTION_BACKLOG.md */
  menuItemsInCatalog?: number;
  features: {
    qrOrdering: boolean;
    inventory: boolean;
    apiAccess: boolean;
    aiDailySummary?: boolean;
    aiWeeklyDigest?: boolean;
    aiLowStockCommentary?: boolean;
    aiUnderperformingItems?: boolean;
    aiBranchCompare?: boolean;
    aiPromotionIdeas?: boolean;
    aiSocialDrafts?: boolean;
  };
  access: { ok: boolean; code?: string; message?: string };
  limits: {
    maxBranches: number;
    branchesInUse: number;
    maxUsers: number;
    usersInUse: number;
  };
};

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SetupPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenantId);
  const branchId = useBranchId();
  const [demoSessionToken, setDemoSessionToken] = useState('example-session-token');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const feedbackFormRef = useRef<HTMLFormElement>(null);

  const feedbackMutation = useMutation({
    mutationFn: (body: {
      category: string;
      severity: 'low' | 'medium' | 'high';
      message: string;
      context?: string;
    }) =>
      apiFetch<{ ok: boolean }>(tenantPaths.pilotFeedback(), {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });

  const commerceQ = useQuery({
    queryKey: ['tenant-commerce', tenantId],
    queryFn: () => apiFetch<CommerceReadModel>(tenantPaths.commerce()),
  });

  const q = useQuery({
    queryKey: ['onboarding-status', branchId],
    queryFn: () =>
      apiFetch<OnboardingStatus>(branchPaths.onboardingStatus(branchId!)),
    enabled: !!branchId,
  });

  const forbidden =
    q.error instanceof ApiError && q.error.status === 403;

  const configQ = useQuery({
    queryKey: ['config-snapshot', branchId],
    queryFn: () =>
      apiFetch<{
        branch: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          currency: string;
          settings: { qrOrderingEnabled: boolean; qrCallWaiterEnabled: boolean };
        };
        environment: {
          appPublicUrlConfigured: boolean;
          publicMenuUrlTemplate: string | null;
        };
      }>(branchPaths.configSnapshot(branchId!)),
    enabled: !!branchId && !forbidden,
  });

  const snoozeMut = useMutation({
    mutationFn: (body: {
      stepId: 'session';
      snoozeDays?: number;
      dismiss?: boolean;
      clear?: boolean;
    }) =>
      apiFetch<OnboardingStatus>(branchPaths.onboardingUi(branchId!), {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding-status', branchId] });
    },
  });

  const goLiveMut = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; acknowledgedAt: string }>(
        branchPaths.goLiveAck(branchId!),
        {
          method: 'POST',
          body: JSON.stringify({ confirm: true }),
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding-status', branchId] });
    },
  });

  const patchBranchMut = useMutation({
    mutationFn: (body: {
      qrOrderingEnabled?: boolean;
      qrCallWaiterEnabled?: boolean;
    }) =>
      apiFetch(branchPaths.patchBranch(branchId!), {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding-status', branchId] });
      void queryClient.invalidateQueries({ queryKey: ['config-snapshot', branchId] });
    },
  });

  const guestPreviewUrl = useMemo(() => {
    const tpl = q.data?.publicMenuUrlTemplate;
    if (!tpl) {
      return '';
    }
    const tok = demoSessionToken.trim() || 'demo-token';
    return tpl.replace('{sessionToken}', tok);
  }, [q.data?.publicMenuUrlTemplate, demoSessionToken]);

  useEffect(() => {
    if (!guestPreviewUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(guestPreviewUrl, { width: 240, margin: 2 })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [guestPreviewUrl]);

  useEffect(() => {
    if (!feedbackMutation.isSuccess) {
      return;
    }
    feedbackFormRef.current?.reset();
  }, [feedbackMutation.isSuccess]);

  return (
    <PageFrame size="wide">
      <PageHeader
        eyebrow={t.setupPage.pageEyebrow}
        title={t.setupPage.pageTitle}
        description={t.setupPage.pageDescription}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t.setupPage.metrics.setupStatus}
          value={
            q.data?.readyForGoLive
              ? t.setupPage.metrics.ready
              : q.data
                ? t.setupPage.metrics.inProgress
                : t.setupPage.metrics.dash
          }
          detail={
            q.data
              ? t.setupPage.metrics.progressDetail.replace(
                  '{percent}',
                  String(q.data.progressPercent),
                )
              : t.setupPage.metrics.progressWaiting
          }
          tone={q.data?.readyForGoLive ? 'emerald' : 'amber'}
        />
        <MetricCard
          label={t.setupPage.metrics.blockingItems}
          value={q.data?.blockingIncompleteCount ?? t.setupPage.metrics.dash}
          detail={t.setupPage.metrics.blockingDetail}
          tone={(q.data?.blockingIncompleteCount ?? 0) > 0 ? 'danger' : 'default'}
        />
        <MetricCard
          label={t.setupPage.metrics.plan}
          value={commerceQ.data?.subscriptionPlan ?? t.setupPage.metrics.dash}
          detail={
            commerceQ.data
              ? commerceQ.data.billingStatus
              : t.setupPage.metrics.planDetailLoading
          }
        />
        <MetricCard
          label={t.setupPage.metrics.branchUrl}
          value={configQ.data?.branch.slug ?? t.setupPage.metrics.dash}
          detail={
            configQ.data?.environment.appPublicUrlConfigured
              ? t.setupPage.metrics.publicUrlConfigured
              : t.setupPage.metrics.publicUrlMissing
          }
          tone={configQ.data?.environment.appPublicUrlConfigured ? 'emerald' : 'amber'}
        />
      </div>

      {q.isLoading || commerceQ.isLoading || configQ.isLoading ? (
        <StatePanel
          variant="loading"
          title={t.setupPage.loading.title}
          description={t.setupPage.loading.description}
        />
      ) : null}

      {q.data && !q.data.appPublicUrlConfigured ? (
        <div
          className="mb-6 rounded-lg border border-amber-700/80 bg-amber-950/50 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          <strong className="text-amber-50">
            {t.setupPage.appPublicUrlAlert.strong}
          </strong>{' '}
          {t.setupPage.appPublicUrlAlert.beforeCode}
          <code className="text-emerald-400">{t.setupPage.appPublicUrlCode}</code>
          {t.setupPage.appPublicUrlAlert.afterCode}
        </div>
      ) : null}

      {commerceQ.data ? (
        <section className="mb-8 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="mb-2 font-medium">{t.setupPage.planSection.title}</h2>
          {commerceQ.data.access && !commerceQ.data.access.ok ? (
            <div className="mb-3 rounded border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
              {commerceQ.data.access.message ??
                t.setupPage.planSection.commerceRestrictionFallback}
              {commerceQ.data.access.code ? (
                <span className="ms-2 font-mono text-xs text-amber-200/80">
                  ({commerceQ.data.access.code})
                </span>
              ) : null}
            </div>
          ) : null}
          {(() => {
            const lim = commerceQ.data.limits;
            const brRem = Math.max(
              0,
              (lim?.maxBranches ?? commerceQ.data.maxBranches) -
                (lim?.branchesInUse ?? commerceQ.data.branchesInUse),
            );
            const seatRem = Math.max(
              0,
              (lim?.maxUsers ?? commerceQ.data.maxUsers) -
                (lim?.usersInUse ?? commerceQ.data.usersInUse),
            );
            return (
              <>
                {brRem === 0 ? (
                  <div
                    className="mb-3 rounded border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100"
                    role="status"
                  >
                    <strong className="text-amber-50">
                      {t.setupPage.planSection.branchLimitTitle}
                    </strong>{' '}
                    {t.setupPage.planSection.branchLimitBody}
                  </div>
                ) : null}
                {seatRem === 0 ? (
                  <div
                    className="mb-3 rounded border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100"
                    role="status"
                  >
                    <strong className="text-amber-50">
                      {t.setupPage.planSection.seatLimitTitle}
                    </strong>{' '}
                    {t.setupPage.planSection.seatLimitBody}
                  </div>
                ) : null}
                {typeof commerceQ.data.menuItemsInCatalog === 'number' &&
                commerceQ.data.menuItemsInCatalog >= 80 ? (
                  <div
                    className="mb-3 rounded border border-slate-600 bg-slate-950/50 px-3 py-2 text-xs text-slate-300"
                    role="note"
                  >
                    {t.setupPage.planSection.largeMenuBefore.replace(
                      '{count}',
                      String(commerceQ.data.menuItemsInCatalog),
                    )}
                    <strong className="text-slate-200">
                      {t.setupPage.planSection.largeMenuStrong}
                    </strong>
                    {t.setupPage.planSection.largeMenuAfter}
                  </div>
                ) : null}
              </>
            );
          })()}
          <dl className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t.setupPage.planDl.plan}</dt>
              <dd className="capitalize">{commerceQ.data.subscriptionPlan}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.setupPage.planDl.billingStatus}</dt>
              <dd className="capitalize">
                {commerceQ.data.billingStatus.replace(/_/g, ' ')}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.setupPage.planDl.branches}</dt>
              <dd>
                {commerceQ.data.limits?.branchesInUse ??
                  commerceQ.data.branchesInUse}{' '}
                /{' '}
                {commerceQ.data.limits?.maxBranches ??
                  commerceQ.data.maxBranches}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.setupPage.planDl.staffSeats}</dt>
              <dd>
                {commerceQ.data.limits?.usersInUse ??
                  commerceQ.data.usersInUse}{' '}
                /{' '}
                {commerceQ.data.limits?.maxUsers ?? commerceQ.data.maxUsers}
              </dd>
            </div>
            {typeof commerceQ.data.menuItemsInCatalog === 'number' ? (
              <div>
                <dt className="text-slate-500">{t.setupPage.planDl.menuLineItems}</dt>
                <dd>{commerceQ.data.menuItemsInCatalog}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-slate-500">{t.setupPage.planDl.trialEnds}</dt>
              <dd>
                {commerceQ.data.trialEndsAt
                  ? new Date(commerceQ.data.trialEndsAt).toLocaleString()
                  : t.setupPage.planDl.emDash}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            <strong className="text-slate-400">{t.setupPage.staffLogins.label}</strong>{' '}
            {t.setupPage.staffLogins.lead}
            <strong className="text-slate-300">{t.setupPage.staffLogins.invitesStrong}</strong>
            {t.setupPage.staffLogins.mid}
            <code className="text-emerald-400">/tenants/invites</code>
            {t.setupPage.staffLogins.tail}
          </p>
        </section>
      ) : null}

      {configQ.data ? (
        <section className="mb-8 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="mb-3 font-medium">{t.setupPage.envSection.title}</h2>
          <p className="mb-3 text-xs text-slate-500">
            {t.setupPage.envSection.readOnlyNote}
            <code className="text-emerald-400">{t.setupPage.appPublicUrlCode}</code>
            {t.setupPage.envSection.readOnlyNoteAfterCode}
          </p>
          <dl className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t.setupPage.envDl.branch}</dt>
              <dd>
                {configQ.data.branch.name}{' '}
                <span className="text-slate-500">({configQ.data.branch.slug})</span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.setupPage.envDl.timezoneCurrency}</dt>
              <dd>
                {configQ.data.branch.timezone} / {configQ.data.branch.currency}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.setupPage.envDl.guestUrlPatternOk}</dt>
              <dd>
                {configQ.data.environment.appPublicUrlConfigured ? (
                  <span className="text-emerald-400">{t.setupPage.envDl.yes}</span>
                ) : (
                  <span className="text-amber-300">{t.setupPage.envDl.no}</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
            <p className="text-xs text-slate-500">
              {t.setupPage.guestSettings.auditedLabel}
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="rounded border-slate-600"
                checked={configQ.data.branch.settings.qrOrderingEnabled}
                disabled={patchBranchMut.isPending}
                onChange={(e) =>
                  patchBranchMut.mutate({ qrOrderingEnabled: e.target.checked })
                }
              />
              {t.setupPage.guestSettings.qrOrdering}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="rounded border-slate-600"
                checked={configQ.data.branch.settings.qrCallWaiterEnabled}
                disabled={patchBranchMut.isPending}
                onChange={(e) =>
                  patchBranchMut.mutate({ qrCallWaiterEnabled: e.target.checked })
                }
              />
              {t.setupPage.guestSettings.qrCallWaiter}
            </label>
          </div>
        </section>
      ) : null}

      {forbidden ? (
        <p className="text-amber-200">
          {t.setupPage.forbidden.beforeCode}
          <code className="text-emerald-400">settings.manage</code>
          {t.setupPage.forbidden.afterCode}
        </p>
      ) : null}

      {q.error && !forbidden ? (
        <p className="text-red-400">{(q.error as Error).message}</p>
      ) : null}

      {q.data ? (
        <div className="space-y-8">
          {q.data.readyForGoLive ? (
            <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
              {t.setupPage.goLive.completeBannerBefore}
              <strong>{t.setupPage.goLive.completeBannerStrong}</strong>
              {t.setupPage.goLive.completeBannerAfter}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
              <strong>{t.setupPage.goLive.notReadyTitle}</strong>{' '}
              {q.data.blockingIncompleteCount === 1
                ? t.setupPage.goLive.notReadyCountOne.replace(
                    '{count}',
                    String(q.data.blockingIncompleteCount),
                  )
                : t.setupPage.goLive.notReadyCountMany.replace(
                    '{count}',
                    String(q.data.blockingIncompleteCount),
                  )}{' '}
              {t.setupPage.goLive.notReadyTail}
            </div>
          )}

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-2 font-medium">{t.setupPage.goLiveAck.title}</h2>
            <p className="mb-3 text-sm text-slate-400">
              {t.setupPage.goLiveAck.description}
            </p>
            {q.data.goLiveAcknowledgedAt ? (
              <p className="text-sm text-emerald-300">
                {t.setupPage.goLiveAck.recordedAt}{' '}
                {new Date(q.data.goLiveAcknowledgedAt).toLocaleString()}
              </p>
            ) : (
              <button
                type="button"
                disabled={!q.data.readyForGoLive || goLiveMut.isPending}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => goLiveMut.mutate()}
              >
                {goLiveMut.isPending
                  ? t.setupPage.goLiveAck.saving
                  : q.data.readyForGoLive
                    ? t.setupPage.goLiveAck.recordButton
                    : t.setupPage.goLiveAck.completeBlockingFirst}
              </button>
            )}
            {goLiveMut.error ? (
              <p className="mt-2 text-sm text-red-400">
                {(goLiveMut.error as Error).message}
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">{t.setupPage.progressSection.title}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-xs text-emerald-400 underline"
                  onClick={() => {
                    downloadTextFile(
                      `onboarding-${q.data.branchSlug}.csv`,
                      buildOnboardingChecklistCsv(q.data.steps, t.setupPage),
                    );
                  }}
                >
                  {t.setupPage.progressSection.exportCsv}
                </button>
                <span className="text-sm text-emerald-400">
                  {q.data.progressPercent}%
                </span>
              </div>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded bg-slate-800">
              <div
                className="absolute inset-y-0 inset-s-0 bg-emerald-600 transition-[width]"
                style={{ width: `${q.data.progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {t.setupPage.progressSection.includesRecommended}
              <strong>{t.setupPage.progressSection.includesRecommendedStrong}</strong>
              {t.setupPage.progressSection.includesRecommendedEnd}
            </p>
          </section>

          <section className="rounded-lg border border-red-900/40 bg-slate-900/40 p-4">
            <h2 className="mb-3 font-medium text-red-200/90">{t.setupPage.tiers.blocking}</h2>
            <ul className="space-y-3 text-sm">
              {q.data.steps
                .filter((s) => s.tier === 'blocking')
                .map((s) => {
                  const { label, why } = resolveOnboardingStepCopy(
                    s,
                    t.setupPage.onboardingSteps,
                  );
                  return (
                  <li
                    key={s.id}
                    className={
                      s.done ? 'text-emerald-400' : 'text-slate-300'
                    }
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span>
                        {s.done ? '✓' : '○'} {label}
                      </span>
                      {!s.done ? (
                        <Link
                          className="text-xs text-emerald-500 underline"
                          to={s.nextPath}
                        >
                          {t.setupPage.stepGo}
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{why}</p>
                  </li>
                  );
                })}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
            <h2 className="mb-3 font-medium text-slate-300">{t.setupPage.tiers.recommended}</h2>
            <ul className="space-y-3 text-sm text-slate-400">
              {q.data.steps
                .filter((s) => s.tier === 'recommended')
                .map((s) => {
                  const { label, why } = resolveOnboardingStepCopy(
                    s,
                    t.setupPage.onboardingSteps,
                  );
                  return (
                  <li key={s.id}>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span>
                        {s.done ? '✓' : '○'} {label}
                        {s.snoozedUntil ? (
                          <span className="ms-2 text-xs text-slate-500">
                            {t.setupPage.snoozedUntil.replace(
                              '{at}',
                              new Date(s.snoozedUntil).toLocaleString(),
                            )}
                          </span>
                        ) : null}
                        {s.dismissed ? (
                          <span className="ms-2 text-xs text-slate-500">
                            {t.setupPage.dismissedFromProgress}
                          </span>
                        ) : null}
                      </span>
                      {!s.done ? (
                        <Link
                          className="text-xs text-emerald-500 underline"
                          to={s.nextPath}
                        >
                          {t.setupPage.stepGo}
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{why}</p>
                    {s.id === 'session' && !s.done ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                          disabled={snoozeMut.isPending}
                          onClick={() =>
                            snoozeMut.mutate({ stepId: 'session', snoozeDays: 7 })
                          }
                        >
                          {t.setupPage.snooze7Days}
                        </button>
                        <button
                          type="button"
                          className="rounded border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                          disabled={snoozeMut.isPending}
                          onClick={() =>
                            snoozeMut.mutate({ stepId: 'session', dismiss: true })
                          }
                        >
                          {t.setupPage.dismissFromProgress}
                        </button>
                        {(s.snoozedUntil || s.dismissed) && (
                          <button
                            type="button"
                            className="rounded border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                            disabled={snoozeMut.isPending}
                            onClick={() =>
                              snoozeMut.mutate({ stepId: 'session', clear: true })
                            }
                          >
                            {t.setupPage.resetNudge}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </li>
                  );
                })}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-2 font-medium">{t.setupPage.guestMenuTitle}</h2>
            <p className="text-sm text-slate-400">
              {t.setupPage.guestMenuLeadBeforeStrong}
              <strong className="text-slate-300">{t.setupPage.guestMenuStrong}</strong>
              {t.setupPage.guestMenuLeadAfterStrong}
              <Link className="text-emerald-500 underline" to="/floor">
                {t.setupPage.floorLink}
              </Link>
              {t.setupPage.guestMenuLeadAfterFloor}
            </p>
            {q.data.publicMenuUrlTemplate ? (
              <code className="mt-2 block break-all rounded bg-slate-950 p-2 text-xs text-slate-300">
                {q.data.publicMenuUrlTemplate}
              </code>
            ) : (
              <p className="mt-2 text-sm text-amber-200">
                {t.setupPage.appPublicUrlHintBeforeCode}
                <code className="text-emerald-400">{t.setupPage.appPublicUrlCode}</code>
                {t.setupPage.appPublicUrlHintAfterCode}
              </p>
            )}
            <div className="mt-4 space-y-2">
              <label className="block text-sm text-slate-400">
                {t.setupPage.previewTokenLabel}
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-200"
                  value={demoSessionToken}
                  onChange={(e) => setDemoSessionToken(e.target.value)}
                  placeholder={t.setupPage.tokenPlaceholder}
                />
              </label>
              {guestPreviewUrl ? (
                <p className="break-all font-mono text-xs text-slate-500">
                  {guestPreviewUrl}
                </p>
              ) : null}
              {qrDataUrl ? (
                <div className="flex flex-wrap items-end gap-4">
                  <img
                    src={qrDataUrl}
                    alt={t.setupPage.qrAlt}
                    className="rounded border border-slate-700 bg-white p-2"
                    width={240}
                    height={240}
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-white"
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = qrDataUrl;
                        a.download = `guest-qr-${q.data.branchSlug}.png`;
                        a.click();
                      }}
                    >
                      {t.setupPage.downloadPng}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300"
                      onClick={() => {
                        const w = window.open('', '_blank');
                        if (w) {
                          w.document.write(
                            `<img src="${qrDataUrl}" style="max-width:100%" /><p style="font-family:sans-serif">${t.setupPage.printWindowGuestUrl}</p>`,
                          );
                          w.print();
                        }
                      }}
                    >
                      {t.setupPage.print}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-slate-400">
              {t.setupPage.qrWrongSiteBefore}
              <code className="text-emerald-400">{t.setupPage.appPublicUrlCode}</code>
              {t.setupPage.qrWrongSiteAfter}
            </p>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-2 font-medium">{t.setupPage.printers.title}</h2>
            <ul className="list-disc space-y-1 ps-5 text-sm text-slate-400">
              <li>{t.setupPage.printers.li1}</li>
              <li>{t.setupPage.printers.li2}</li>
              <li>{t.setupPage.printers.li3}</li>
            </ul>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-2 font-medium">{t.setupPage.kitchenBar.title}</h2>
            <ul className="list-disc space-y-1 ps-5 text-sm text-slate-400">
              <li>
                {t.setupPage.kitchenBar.li1a}
                <Link className="text-emerald-500 underline" to="/kitchen">
                  {t.setupPage.kitchenBar.kitchen}
                </Link>
                {t.setupPage.kitchenBar.li1b}
                <Link className="text-emerald-500 underline" to="/bar">
                  {t.setupPage.kitchenBar.bar}
                </Link>
                {t.setupPage.kitchenBar.li1c}
              </li>
              <li>{t.setupPage.kitchenBar.li2}</li>
              <li>{t.setupPage.kitchenBar.li3}</li>
            </ul>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-2 font-medium">{t.setupPage.cashierShift.title}</h2>
            <p className="text-sm text-slate-400">{t.setupPage.cashierShift.body}</p>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-2 font-medium">{t.setupPage.pilotFeedback.title}</h2>
            <p className="mb-3 text-sm text-slate-400">{t.setupPage.pilotFeedback.lead}</p>
            <form
              ref={feedbackFormRef}
              className="space-y-3 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const category = String(fd.get('category') ?? '').trim();
                const message = String(fd.get('message') ?? '').trim();
                const severity = fd.get('severity') as 'low' | 'medium' | 'high';
                const context = String(fd.get('context') ?? '').trim();
                if (!category || !message) return;
                feedbackMutation.mutate({
                  category,
                  severity,
                  message,
                  context: context || undefined,
                });
              }}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-slate-500">{t.setupPage.pilotFeedback.category}</span>
                  <input
                    name="category"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                    placeholder={t.setupPage.pilotFeedback.categoryPlaceholder}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500">{t.setupPage.pilotFeedback.severity}</span>
                  <select
                    name="severity"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                    defaultValue="low"
                  >
                    <option value="low">{t.setupPage.pilotFeedback.severityLow}</option>
                    <option value="medium">{t.setupPage.pilotFeedback.severityMedium}</option>
                    <option value="high">{t.setupPage.pilotFeedback.severityHigh}</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-slate-500">{t.setupPage.pilotFeedback.details}</span>
                <textarea
                  name="message"
                  className="mt-1 min-h-[88px] w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                  placeholder={t.setupPage.pilotFeedback.detailsPlaceholder}
                  required
                />
              </label>
              <label className="block">
                <span className="text-slate-500">
                  {t.setupPage.pilotFeedback.contextOptional}
                </span>
                <input
                  name="context"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                  placeholder={t.setupPage.pilotFeedback.contextPlaceholder}
                />
              </label>
              <Button type="submit" disabled={feedbackMutation.isPending}>
                {feedbackMutation.isPending
                  ? t.setupPage.pilotFeedback.sending
                  : t.setupPage.pilotFeedback.send}
              </Button>
              {feedbackMutation.isSuccess ? (
                <span className="ms-2 text-emerald-400" role="status">
                  {t.setupPage.pilotFeedback.thanks}
                </span>
              ) : null}
              {feedbackMutation.error ? (
                <span className="ms-2 text-red-400" role="alert">
                  {(feedbackMutation.error as Error).message}
                </span>
              ) : null}
            </form>
          </section>
        </div>
      ) : null}
    </PageFrame>
  );
}
