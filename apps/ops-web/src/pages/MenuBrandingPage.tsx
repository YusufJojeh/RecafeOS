import type {
  AccessibleColorPair,
  LogoAnalysisResult,
  PaletteProposal,
  PublicMenuBrandingTheme,
  VisualIdentityEstimate,
} from '@restocafe/types';
import {
  MENU_BRANDING_BUTTON_STYLES,
  MENU_BRANDING_CARD_STYLES,
  MENU_BRANDING_COLOR_MODES,
  MENU_BRANDING_LAYOUTS,
  MENU_BRANDING_PRESET_IDS,
  MENU_BRANDING_SURFACES,
  MENU_BRANDING_TYPOGRAPHY,
} from '@restocafe/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/i18n/context';
import type { ContentMap } from '@/i18n/types';
import { apiFetch, getToken, tenantPaths, uploadMenuBrandingLogo } from '@/lib/api';
import { describeApiError } from '@/lib/api-error-copy';
import {
  BUILTIN_PUBLIC_MENU_THEME,
  themeToCssVars,
} from '@/lib/public-menu-theme';

type BrandingStateResponse = {
  draft: PublicMenuBrandingTheme;
  published: PublicMenuBrandingTheme | null;
  publishedAt: string | null;
  isDirty: boolean;
  lastAnalysis: unknown;
  publishedLogoUrl: string | null;
  hasDraftLogo: boolean;
};

const base = import.meta.env.VITE_API_URL ?? '/api/v1';

/** Minimal subset of guest menu utility classes for the live preview card. */
const BRANDING_PREVIEW_CSS = `
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
.pm-text-muted { color: var(--pm-muted); }
.pm-text-primary { color: var(--pm-text); }
`;

function usageLabel(
  t: ContentMap,
  key: AccessibleColorPair['usageKey'],
): string {
  const map = t.branding.usageKeys as Record<string, string>;
  return map[key] ?? key;
}

function WcagFlag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? 'font-medium text-green-700 dark:text-green-400'
          : 'text-muted-foreground line-through opacity-50'
      }
    >
      {label}
    </span>
  );
}

function AnalysisPanel({
  analysis,
  presetLabels,
  t,
}: {
  analysis: unknown;
  presetLabels: Record<string, string>;
  t: ContentMap;
}) {
  if (!analysis || typeof analysis !== 'object') return null;
  const a = analysis as Partial<LogoAnalysisResult> & {
    dominantColors?: string[];
    contrastNote?: string;
    brandTones?: string[];
    suggestedPreset?: string;
  };
  const rich =
    'contrastPairs' in a &&
    Array.isArray(a.contrastPairs) &&
    'paletteProposal' in a &&
    a.paletteProposal &&
    typeof a.paletteProposal === 'object';

  const toneMap = t.branding.tones as Record<string, string>;

  return (
    <div className="space-y-4 rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="font-medium">{t.branding.analysisTitle}</p>
      <p className="text-xs text-muted-foreground">{t.branding.analysisSuggestionsOnly}</p>
      {!rich ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">{t.branding.reanalyzeForFullReport}</p>
      ) : null}

      {'insightSummary' in a && typeof a.insightSummary === 'string' ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.branding.analysisSummary}
          </p>
          <p className="mt-1 leading-relaxed text-foreground">{a.insightSummary}</p>
        </div>
      ) : null}

      <ul className="list-inside list-disc text-muted-foreground">
        <li>
          {t.branding.dominantColors}{' '}
          {(a.dominantColors ?? []).join(', ') || '—'}
        </li>
        {a.contrastNote ? <li>{a.contrastNote}</li> : null}
        <li>
          {t.branding.suggestedTone}{' '}
          {(a.brandTones ?? [])
            .map((x) => toneMap[x] ?? x)
            .join(', ') || '—'}
        </li>
        <li>
          {t.branding.suggestedPreset}{' '}
          {a.suggestedPreset
            ? (presetLabels[a.suggestedPreset] ?? a.suggestedPreset)
            : '—'}
        </li>
      </ul>

      {'presetRationale' in a && typeof a.presetRationale === 'string' ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.branding.analysisPresetRationale}
          </p>
          <p className="mt-1 text-muted-foreground">{a.presetRationale}</p>
        </div>
      ) : null}

      {rich && a.contrastPairs ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.branding.analysisContrastPairs}
          </p>
          <ul className="mt-2 space-y-3">
            {a.contrastPairs.map((pair: AccessibleColorPair) => (
              <li
                key={`${pair.usageKey}-${pair.foregroundHex}-${pair.backgroundHex}`}
                className="rounded-md border border-border/60 bg-background/80 p-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded border px-2 py-0.5 font-mono text-xs"
                    style={{
                      backgroundColor: pair.backgroundHex,
                      color: pair.foregroundHex,
                    }}
                  >
                    Aa عربي
                  </span>
                  <span className="text-xs font-medium">{usageLabel(t, pair.usageKey)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{pair.explanation}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <span>
                    {t.branding.contrastRatio}: {pair.ratio.toFixed(2)}:1
                  </span>
                  <WcagFlag ok={pair.meetsAaBodyText} label={t.branding.wcagAaBody} />
                  <WcagFlag ok={pair.meetsAaLargeText} label={t.branding.wcagAaLarge} />
                  <WcagFlag ok={pair.meetsAaaBodyText} label={t.branding.wcagAaaBody} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rich && a.paletteProposal && typeof a.paletteProposal === 'object' ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.branding.analysisPaletteProposal}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {(['primaryHex', 'secondaryHex', 'accentHex'] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span
                  className="h-8 w-8 rounded border shadow-sm"
                  style={{
                    backgroundColor: (a.paletteProposal as PaletteProposal)[k],
                  }}
                  title={(a.paletteProposal as PaletteProposal)[k]}
                />
                <span className="font-mono text-xs">
                  {(a.paletteProposal as PaletteProposal)[k]}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-muted-foreground">{(a.paletteProposal as PaletteProposal).rationale}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(a.paletteProposal as PaletteProposal).accessibilityNote}
          </p>
        </div>
      ) : null}

      {rich && Array.isArray(a.visualIdentity) ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.branding.analysisVisualIdentity}
          </p>
          <ul className="mt-2 space-y-2">
            {a.visualIdentity.map((row: VisualIdentityEstimate) => (
              <li key={row.direction} className="rounded-md border border-border/50 bg-background/60 p-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{toneMap[row.direction] ?? row.direction}</span>
                  <span className="font-mono text-xs text-muted-foreground">{row.score}/100</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{row.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {a.suggestions && typeof a.suggestions === 'object' ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.branding.analysisStyleHints}
          </p>
          <ul className="mt-2 space-y-2 text-muted-foreground">
            {'headerReason' in a.suggestions && (a.suggestions as { headerReason?: string }).headerReason ? (
              <li>
                <span className="font-medium text-foreground">Header: </span>
                {(a.suggestions as { headerReason: string }).headerReason}
              </li>
            ) : null}
            {'buttonReason' in a.suggestions && (a.suggestions as { buttonReason?: string }).buttonReason ? (
              <li>
                <span className="font-medium text-foreground">Buttons: </span>
                {(a.suggestions as { buttonReason: string }).buttonReason}
              </li>
            ) : null}
            {'cardReason' in a.suggestions && (a.suggestions as { cardReason?: string }).cardReason ? (
              <li>
                <span className="font-medium text-foreground">Cards: </span>
                {(a.suggestions as { cardReason: string }).cardReason}
              </li>
            ) : null}
            {'typographyReason' in a.suggestions &&
            (a.suggestions as { typographyReason?: string }).typographyReason ? (
              <li>
                <span className="font-medium text-foreground">Typography: </span>
                {(a.suggestions as { typographyReason: string }).typographyReason}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function MenuBrandingPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PublicMenuBrandingTheme | null>(null);
  const [draftImgUrl, setDraftImgUrl] = useState<string | null>(null);

  const state = useQuery({
    queryKey: ['menu-branding'],
    queryFn: () => apiFetch<BrandingStateResponse>(tenantPaths.menuBranding()),
  });

  useEffect(() => {
    if (state.data?.draft) setDraft(state.data.draft);
  }, [state.data?.draft, state.dataUpdatedAt]);

  /* eslint-disable react-hooks/exhaustive-deps -- draftImgUrl is effect output; listing it would loop */
  useEffect(() => {
    if (!state.data?.hasDraftLogo) {
      if (draftImgUrl) URL.revokeObjectURL(draftImgUrl);
      setDraftImgUrl(null);
      return;
    }
    let cancelled = false;
    const token = getToken();
    (async () => {
      const res = await fetch(`${base}${tenantPaths.menuBrandingDraftLogo()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      setDraftImgUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [state.data?.hasDraftLogo, state.dataUpdatedAt]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const saveDraft = useMutation({
    mutationFn: (body: Partial<PublicMenuBrandingTheme>) =>
      apiFetch<PublicMenuBrandingTheme>(tenantPaths.menuBrandingDraft(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (next) => {
      setDraft(next);
      void qc.invalidateQueries({ queryKey: ['menu-branding'] });
    },
  });

  const publish = useMutation({
    mutationFn: () =>
      apiFetch<BrandingStateResponse>(tenantPaths.menuBrandingPublish(), {
        method: 'POST',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['menu-branding'] }),
  });

  const analyze = useMutation({
    mutationFn: () =>
      apiFetch<LogoAnalysisResult>(tenantPaths.menuBrandingAnalyze(), {
        method: 'POST',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['menu-branding'] }),
  });

  const applyAnalysis = useMutation({
    mutationFn: () =>
      apiFetch<PublicMenuBrandingTheme>(tenantPaths.menuBrandingApplyAnalysis(), {
        method: 'POST',
      }),
    onSuccess: (next) => {
      setDraft(next);
      void qc.invalidateQueries({ queryKey: ['menu-branding'] });
    },
  });

  const removeLogo = useMutation({
    mutationFn: () =>
      apiFetch(tenantPaths.menuBrandingLogo(), { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['menu-branding'] }),
  });

  const previewVars = useMemo(
    () =>
      themeToCssVars(
        draft ?? state.data?.draft ?? BUILTIN_PUBLIC_MENU_THEME,
      ),
    [draft, state.data?.draft],
  );

  const presetLabels = useMemo(
    () =>
      Object.fromEntries(
        MENU_BRANDING_PRESET_IDS.map((id) => [id, t.branding.presets[id as keyof typeof t.branding.presets]]),
      ) as Record<string, string>,
    [t],
  );

  if (state.isError) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
        {describeApiError(state.error, { fallback: t.branding.loadFailed })}
      </div>
    );
  }

  if (!draft || state.isLoading) {
    return (
      <div className="text-sm text-muted-foreground">{t.common.loading}</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.branding.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.branding.subtitle}</p>
        {state.data?.publishedAt ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t.branding.lastPublished.replace('{at}', new Date(state.data.publishedAt).toLocaleString())}
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t.branding.neverPublished}</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.branding.logo}</CardTitle>
              <CardDescription>{t.branding.logoHelp}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    await uploadMenuBrandingLogo(f);
                    await qc.invalidateQueries({ queryKey: ['menu-branding'] });
                  } catch {
                    /* toast optional */
                  }
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                  {t.branding.uploadLogo}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!state.data?.hasDraftLogo || analyze.isPending}
                  onClick={() => analyze.mutate()}
                >
                  {t.branding.analyzeLogo}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!state.data?.lastAnalysis || applyAnalysis.isPending}
                  onClick={() => applyAnalysis.mutate()}
                >
                  {t.branding.applySuggestions}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!state.data?.hasDraftLogo || removeLogo.isPending}
                  onClick={() => removeLogo.mutate()}
                >
                  {t.branding.removeLogo}
                </Button>
              </div>
              {draftImgUrl ? (
                <img
                  src={draftImgUrl}
                  alt=""
                  className="max-h-24 w-auto max-w-full rounded-lg border object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t.branding.noLogo}</p>
              )}
              {state.data?.lastAnalysis ? (
                <AnalysisPanel
                  analysis={state.data.lastAnalysis}
                  presetLabels={presetLabels}
                  t={t}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.branding.presetsTitle}</CardTitle>
              <CardDescription>{t.branding.presetsHelp}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {MENU_BRANDING_PRESET_IDS.map((id) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={draft.preset === id ? 'default' : 'outline'}
                  onClick={() => {
                    setDraft((d) => (d ? { ...d, preset: id } : d));
                    saveDraft.mutate({ preset: id });
                  }}
                >
                  {presetLabels[id] ?? id}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.branding.tokensTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandName">{t.branding.brandName}</Label>
                <Input
                  id="brandName"
                  value={draft.brandName ?? ''}
                  placeholder={t.branding.brandNamePlaceholder}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, brandName: e.target.value || null } : d,
                    )
                  }
                  onBlur={() =>
                    saveDraft.mutate({ brandName: draft.brandName ?? null })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {(['primaryHex', 'secondaryHex', 'accentHex'] as const).map((key) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{t.branding[key]}</Label>
                    <div className="flex gap-2">
                      <Input
                        id={key}
                        type="color"
                        className="h-10 w-14 cursor-pointer p-1"
                        value={draft[key]}
                        onChange={(e) =>
                          setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))
                        }
                        onBlur={() => saveDraft.mutate({ [key]: draft[key] })}
                      />
                      <Input
                        value={draft[key]}
                        onChange={(e) =>
                          setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))
                        }
                        onBlur={() => saveDraft.mutate({ [key]: draft[key] })}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.branding.surface}</Label>
                  <Select
                    value={draft.surface}
                    onValueChange={(v) => {
                      const surface = v as PublicMenuBrandingTheme['surface'];
                      setDraft((d) => (d ? { ...d, surface } : d));
                      saveDraft.mutate({ surface });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_BRANDING_SURFACES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t.branding.surfaces[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.branding.menuLayout}</Label>
                  <Select
                    value={draft.menuLayout}
                    onValueChange={(v) => {
                      const menuLayout = v as PublicMenuBrandingTheme['menuLayout'];
                      setDraft((d) => (d ? { ...d, menuLayout } : d));
                      saveDraft.mutate({ menuLayout });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_BRANDING_LAYOUTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t.branding.layouts[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.branding.cardStyle}</Label>
                  <Select
                    value={draft.cardStyle}
                    onValueChange={(v) => {
                      const cardStyle = v as PublicMenuBrandingTheme['cardStyle'];
                      setDraft((d) => (d ? { ...d, cardStyle } : d));
                      saveDraft.mutate({ cardStyle });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_BRANDING_CARD_STYLES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t.branding.cards[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.branding.buttonStyle}</Label>
                  <Select
                    value={draft.buttonStyle}
                    onValueChange={(v) => {
                      const buttonStyle = v as PublicMenuBrandingTheme['buttonStyle'];
                      setDraft((d) => (d ? { ...d, buttonStyle } : d));
                      saveDraft.mutate({ buttonStyle });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_BRANDING_BUTTON_STYLES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t.branding.buttons[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.branding.typography}</Label>
                  <Select
                    value={draft.typography}
                    onValueChange={(v) => {
                      const typography = v as PublicMenuBrandingTheme['typography'];
                      setDraft((d) => (d ? { ...d, typography } : d));
                      saveDraft.mutate({ typography });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_BRANDING_TYPOGRAPHY.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t.branding.typographyOpts[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.branding.colorMode}</Label>
                  <Select
                    value={draft.colorMode}
                    onValueChange={(v) => {
                      const colorMode = v as PublicMenuBrandingTheme['colorMode'];
                      setDraft((d) => (d ? { ...d, colorMode } : d));
                      saveDraft.mutate({ colorMode });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_BRANDING_COLOR_MODES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t.branding.modes[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  type="button"
                  disabled={publish.isPending || !state.data?.isDirty}
                  onClick={() => publish.mutate()}
                >
                  {t.branding.publish}
                </Button>
                {state.data?.isDirty ? (
                  <span className="self-center text-xs text-amber-700 dark:text-amber-400">
                    {t.branding.unpublishedChanges}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardHeader>
            <CardTitle>{t.branding.livePreview}</CardTitle>
            <CardDescription>{t.branding.previewHelp}</CardDescription>
          </CardHeader>
          <CardContent>
            <style dangerouslySetInnerHTML={{ __html: BRANDING_PREVIEW_CSS }} />
            <div
              className="pm-root overflow-hidden rounded-2xl border shadow-sm"
              style={previewVars}
            >
              <div className="pm-mesh-bg pointer-events-none h-24 rounded-t-2xl" />
              <div className="space-y-3 p-4">
                <div className="pm-header-surface rounded-2xl p-4">
                  <div className="pm-badge-pill inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                    {t.publicMenu.badge}
                  </div>
                  {draftImgUrl ? (
                    <img
                      src={draftImgUrl}
                      alt=""
                      className="mt-2 h-8 w-auto max-w-[140px] object-contain"
                    />
                  ) : null}
                  <div className="mt-2 text-lg font-semibold">{draft.brandName ?? t.branding.previewBranch}</div>
                  <p className="mt-1 text-xs pm-text-muted">{t.publicMenu.helper}</p>
                  <button
                    type="button"
                    className="pm-cta-solid mt-3 w-full rounded-full py-2 text-xs font-semibold"
                  >
                    {t.publicMenu.callWaiter}
                  </button>
                </div>
                <div className="pm-section-surface rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider pm-text-muted">
                    {t.branding.previewCategory}
                  </div>
                  <div className="pm-item-surface mt-2 flex gap-2 rounded-lg p-2">
                    <div className="h-14 w-14 shrink-0 rounded-lg bg-[var(--pm-card-inner)]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium pm-text-primary">{t.branding.previewItem}</div>
                      <div className="text-xs pm-text-muted">{t.branding.previewDescription}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold tabular-nums">12.00</span>
                        <span className="pm-gradient-btn px-3 py-1 text-[10px] font-bold uppercase">
                          {t.publicMenu.addToCart}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
