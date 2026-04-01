import type { CSSProperties } from 'react';
import type {
  PublicMenuBrandingPayload,
  PublicMenuBrandingTheme,
} from '@restocafe/types';

/** Matches legacy PublicMenuPage look when API sends no `branding`. */
export const BUILTIN_PUBLIC_MENU_THEME: PublicMenuBrandingTheme = {
  brandName: null,
  preset: 'modern_cafe',
  primaryHex: '#059669',
  secondaryHex: '#ecfdf5',
  accentHex: '#0d9488',
  surface: 'soft_neutral',
  menuLayout: 'standard',
  cardStyle: 'elevated',
  buttonStyle: 'pill',
  typography: 'system',
  colorMode: 'light',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim();
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

type SurfacePal = {
  page: string;
  page2: string;
  card: string;
  cardInner: string;
  text: string;
  muted: string;
  border: string;
  headerBg: string;
  headerBorder: string;
  ctaBg: string;
  ctaFg: string;
};

function surfacePalette(
  surface: PublicMenuBrandingTheme['surface'],
  dark: boolean,
): SurfacePal {
  if (dark) {
    return {
      page: '#0f172a',
      page2: '#1e293b',
      card: 'rgba(30,41,59,0.92)',
      cardInner: 'rgba(15,23,42,0.45)',
      text: '#f8fafc',
      muted: '#94a3b8',
      border: 'rgba(148,163,184,0.28)',
      headerBg: 'rgba(30,41,59,0.82)',
      headerBorder: 'rgba(148,163,184,0.22)',
      ctaBg: '#f1f5f9',
      ctaFg: '#0f172a',
    };
  }
  switch (surface) {
    case 'warm_cream':
      return {
        page: '#fffbeb',
        page2: '#fef3c7',
        card: 'rgba(255,255,255,0.94)',
        cardInner: 'rgba(254,243,199,0.35)',
        text: '#1c1917',
        muted: '#57534e',
        border: 'rgba(120,113,108,0.2)',
        headerBg: 'rgba(255,255,255,0.88)',
        headerBorder: 'rgba(253,230,138,0.45)',
        ctaBg: '#1c1917',
        ctaFg: '#fffbeb',
      };
    case 'cool_slate':
      return {
        page: '#f1f5f9',
        page2: '#e2e8f0',
        card: 'rgba(248,250,252,0.94)',
        cardInner: 'rgba(241,245,249,0.8)',
        text: '#0f172a',
        muted: '#475569',
        border: 'rgba(100,116,139,0.22)',
        headerBg: 'rgba(255,255,255,0.82)',
        headerBorder: 'rgba(148,163,184,0.35)',
        ctaBg: '#0f172a',
        ctaFg: '#f8fafc',
      };
    case 'deep_contrast':
      return {
        page: '#fafafa',
        page2: '#f4f4f5',
        card: 'rgba(255,255,255,0.96)',
        cardInner: 'rgba(244,244,245,0.9)',
        text: '#18181b',
        muted: '#52525b',
        border: 'rgba(24,24,27,0.12)',
        headerBg: 'rgba(255,255,255,0.9)',
        headerBorder: 'rgba(24,24,27,0.08)',
        ctaBg: '#18181b',
        ctaFg: '#fafafa',
      };
    case 'soft_neutral':
    default:
      return {
        page: '#fafafa',
        page2: '#f4f4f5',
        card: 'rgba(255,255,255,0.9)',
        cardInner: 'rgba(244,244,245,0.55)',
        text: '#18181b',
        muted: '#52525b',
        border: 'rgba(24,24,27,0.1)',
        headerBg: 'rgba(255,255,255,0.75)',
        headerBorder: 'rgba(255,255,255,0.6)',
        ctaBg: '#18181b',
        ctaFg: '#ffffff',
      };
  }
}

function btnRadius(style: PublicMenuBrandingTheme['buttonStyle']): string {
  switch (style) {
    case 'square':
      return '0.375rem';
    case 'rounded':
      return '1rem';
    case 'pill':
    default:
      return '9999px';
  }
}

function cardShadow(style: PublicMenuBrandingTheme['cardStyle'], dark: boolean): string {
  switch (style) {
    case 'flat':
      return 'none';
    case 'bordered':
      return dark
        ? '0 0 0 1px rgba(148,163,184,0.35)'
        : '0 0 0 1px rgba(24,24,27,0.12)';
    case 'glass':
      return dark
        ? '0 12px 40px rgba(0,0,0,0.35)'
        : '0 12px 40px rgba(15,23,42,0.06)';
    case 'elevated':
    default:
      return dark
        ? '0 12px 40px rgba(0,0,0,0.45)'
        : '0 12px 40px rgba(15,23,42,0.04)';
  }
}

function cardBackdrop(style: PublicMenuBrandingTheme['cardStyle']): string {
  return style === 'glass' ? 'blur(12px)' : 'none';
}

function fontStack(typography: PublicMenuBrandingTheme['typography']): string {
  switch (typography) {
    case 'readable':
      return 'ui-serif, Georgia, Cambria, "Times New Roman", serif';
    case 'display_soft':
      return 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    case 'system':
    default:
      return 'ui-sans-serif, system-ui, sans-serif';
  }
}

/** Merge API branding with defaults (published payload or draft for preview). */
export function resolvePublicMenuTheme(
  branding: PublicMenuBrandingPayload | null | undefined,
): PublicMenuBrandingTheme {
  if (!branding) return BUILTIN_PUBLIC_MENU_THEME;
  return {
    brandName: branding.brandName,
    preset: branding.preset,
    primaryHex: branding.primaryHex,
    secondaryHex: branding.secondaryHex,
    accentHex: branding.accentHex,
    surface: branding.surface,
    menuLayout: branding.menuLayout,
    cardStyle: branding.cardStyle,
    buttonStyle: branding.buttonStyle,
    typography: branding.typography,
    colorMode: branding.colorMode,
  };
}

export function themeToCssVars(theme: PublicMenuBrandingTheme): CSSProperties {
  const dark = theme.colorMode === 'dark';
  const pal = surfacePalette(theme.surface, dark);
  const { r: pr, g: pg, b: pb } = hexToRgb(theme.primaryHex);
  const { r: ar, g: ag, b: ab } = hexToRgb(theme.accentHex);

  const mesh = dark
    ? `radial-gradient(ellipse 100% 60% at 50% -10%, ${rgba(theme.primaryHex, 0.22)}, transparent 55%), linear-gradient(180deg, ${pal.page} 0%, ${pal.page2} 100%)`
    : `radial-gradient(ellipse 100% 60% at 50% -10%, ${rgba(theme.primaryHex, 0.14)}, transparent 55%), linear-gradient(180deg, ${pal.page} 0%, ${pal.page2} 100%)`;

  const headerPad =
    theme.menuLayout === 'compact'
      ? '1rem'
      : theme.menuLayout === 'featured_hero'
        ? '1.75rem'
        : '1.25rem';

  return {
    ['--pm-page' as string]: pal.page,
    ['--pm-page-2' as string]: pal.page2,
    ['--pm-text' as string]: pal.text,
    ['--pm-muted' as string]: pal.muted,
    ['--pm-border' as string]: pal.border,
    ['--pm-card' as string]: pal.card,
    ['--pm-card-inner' as string]: pal.cardInner,
    ['--pm-header-bg' as string]: pal.headerBg,
    ['--pm-header-border' as string]: pal.headerBorder,
    ['--pm-primary' as string]: theme.primaryHex,
    ['--pm-primary-rgb' as string]: `${pr},${pg},${pb}`,
    ['--pm-secondary' as string]: theme.secondaryHex,
    ['--pm-accent' as string]: theme.accentHex,
    ['--pm-accent-rgb' as string]: `${ar},${ag},${ab}`,
    ['--pm-mesh' as string]: mesh,
    ['--pm-badge-bg' as string]: rgba(theme.primaryHex, dark ? 0.22 : 0.12),
    ['--pm-badge-border' as string]: rgba(theme.primaryHex, dark ? 0.45 : 0.35),
    ['--pm-badge-text' as string]: dark ? pal.text : theme.primaryHex,
    ['--pm-btn-radius' as string]: btnRadius(theme.buttonStyle),
    ['--pm-card-shadow' as string]: cardShadow(theme.cardStyle, dark),
    ['--pm-card-backdrop' as string]: cardBackdrop(theme.cardStyle),
    ['--pm-section-pad' as string]: headerPad,
    ['--pm-font' as string]: fontStack(theme.typography),
    ['--pm-cta-bg' as string]: pal.ctaBg,
    ['--pm-cta-fg' as string]: pal.ctaFg,
  } as CSSProperties;
}

export function publicMenuHeaderTitle(
  theme: PublicMenuBrandingTheme,
  branchName: string,
): string {
  const b = theme.brandName?.trim();
  return b && b.length > 0 ? b : branchName;
}

/** Absolute or same-origin URL for tenant logo on the guest menu. */
export function resolveMenuLogoUrl(
  logoPathOrUrl: string | null | undefined,
  apiBase: string,
): string | null {
  if (!logoPathOrUrl?.trim()) return null;
  const p = logoPathOrUrl.trim();
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    try {
      const origin = new URL(apiBase).origin;
      return `${origin}${p.startsWith('/') ? p : `/${p}`}`;
    } catch {
      return p;
    }
  }
  return p.startsWith('/') ? p : `/${p}`;
}
