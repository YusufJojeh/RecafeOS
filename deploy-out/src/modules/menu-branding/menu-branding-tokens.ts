import { z } from 'zod';
import type {
  MenuBrandingButtonStyle,
  MenuBrandingCardStyle,
  MenuBrandingLayout,
  MenuBrandingPresetId,
  MenuBrandingSurface,
  MenuBrandingTypography,
  PublicMenuBrandingTheme,
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

const hex6 = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Expected #RRGGBB');

export const menuBrandingThemeSchema = z.object({
  brandName: z.string().max(120).nullable().default(null),
  preset: z.enum([...MENU_BRANDING_PRESET_IDS] as [string, ...string[]]),
  primaryHex: hex6,
  secondaryHex: hex6,
  accentHex: hex6,
  surface: z.enum([...MENU_BRANDING_SURFACES] as [string, ...string[]]),
  menuLayout: z.enum([...MENU_BRANDING_LAYOUTS] as [string, ...string[]]),
  cardStyle: z.enum([...MENU_BRANDING_CARD_STYLES] as [string, ...string[]]),
  buttonStyle: z.enum([...MENU_BRANDING_BUTTON_STYLES] as [string, ...string[]]),
  typography: z.enum([...MENU_BRANDING_TYPOGRAPHY] as [string, ...string[]]),
  colorMode: z.enum([...MENU_BRANDING_COLOR_MODES] as [string, ...string[]]),
});

export const patchMenuBrandingDraftSchema = menuBrandingThemeSchema.partial();

export type PatchMenuBrandingDraft = z.infer<typeof patchMenuBrandingDraftSchema>;

export const PRESET_DEFAULTS: Record<
  MenuBrandingPresetId,
  Omit<PublicMenuBrandingTheme, 'brandName'>
> = {
  classic_restaurant: {
    preset: 'classic_restaurant',
    primaryHex: '#7c2d12',
    secondaryHex: '#fef3c7',
    accentHex: '#b45309',
    surface: 'warm_cream',
    menuLayout: 'standard',
    cardStyle: 'elevated',
    buttonStyle: 'rounded',
    typography: 'readable',
    colorMode: 'light',
  },
  premium_fine: {
    preset: 'premium_fine',
    primaryHex: '#1c1917',
    secondaryHex: '#fafaf9',
    accentHex: '#a16207',
    surface: 'deep_contrast',
    menuLayout: 'featured_hero',
    cardStyle: 'glass',
    buttonStyle: 'pill',
    typography: 'display_soft',
    colorMode: 'dark',
  },
  modern_cafe: {
    preset: 'modern_cafe',
    primaryHex: '#0d9488',
    secondaryHex: '#ecfdf5',
    accentHex: '#14b8a6',
    surface: 'soft_neutral',
    menuLayout: 'standard',
    cardStyle: 'bordered',
    buttonStyle: 'pill',
    typography: 'system',
    colorMode: 'light',
  },
  minimal_cafe: {
    preset: 'minimal_cafe',
    primaryHex: '#27272a',
    secondaryHex: '#fafafa',
    accentHex: '#71717a',
    surface: 'soft_neutral',
    menuLayout: 'compact',
    cardStyle: 'flat',
    buttonStyle: 'square',
    typography: 'system',
    colorMode: 'light',
  },
  bakery: {
    preset: 'bakery',
    primaryHex: '#c2410c',
    secondaryHex: '#fff7ed',
    accentHex: '#ea580c',
    surface: 'warm_cream',
    menuLayout: 'standard',
    cardStyle: 'elevated',
    buttonStyle: 'rounded',
    typography: 'display_soft',
    colorMode: 'light',
  },
  casual_dining: {
    preset: 'casual_dining',
    primaryHex: '#1d4ed8',
    secondaryHex: '#eff6ff',
    accentHex: '#2563eb',
    surface: 'cool_slate',
    menuLayout: 'standard',
    cardStyle: 'elevated',
    buttonStyle: 'rounded',
    typography: 'system',
    colorMode: 'light',
  },
};

export function defaultThemeForPreset(
  preset: MenuBrandingPresetId,
): Omit<PublicMenuBrandingTheme, 'brandName'> {
  return { ...PRESET_DEFAULTS[preset] };
}

export function coalesceDraftTheme(raw: unknown): PublicMenuBrandingTheme {
  const defaults: PublicMenuBrandingTheme = {
    ...PRESET_DEFAULTS.modern_cafe,
    brandName: null,
  };
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const merged = { ...defaults, ...obj };
  const parsed = menuBrandingThemeSchema.safeParse(merged);
  if (!parsed.success) return defaults;
  const brandName =
    merged.brandName === undefined
      ? null
      : (merged.brandName as string | null);
  return {
    ...parsed.data,
    brandName,
    preset: parsed.data.preset as MenuBrandingPresetId,
    surface: parsed.data.surface as MenuBrandingSurface,
    menuLayout: parsed.data.menuLayout as MenuBrandingLayout,
    cardStyle: parsed.data.cardStyle as MenuBrandingCardStyle,
    buttonStyle: parsed.data.buttonStyle as MenuBrandingButtonStyle,
    typography: parsed.data.typography as MenuBrandingTypography,
    colorMode: parsed.data.colorMode as PublicMenuBrandingTheme['colorMode'],
  };
}

export function coalescePublishedTheme(
  raw: unknown,
): PublicMenuBrandingTheme | null {
  if (raw == null || (typeof raw === 'object' && Object.keys(raw as object).length === 0)) {
    return null;
  }
  return coalesceDraftTheme(raw);
}

export function mergeThemePatch(
  base: PublicMenuBrandingTheme,
  patch: PatchMenuBrandingDraft,
): PublicMenuBrandingTheme {
  const next = { ...base, ...patch };
  if (patch.preset && patch.preset !== base.preset) {
    const d = PRESET_DEFAULTS[patch.preset as MenuBrandingPresetId];
    const merged: PublicMenuBrandingTheme = {
      ...d,
      ...patch,
      brandName:
        patch.brandName !== undefined ? patch.brandName : base.brandName ?? null,
      preset: (patch.preset ?? d.preset) as MenuBrandingPresetId,
      surface: (patch.surface ?? d.surface) as MenuBrandingSurface,
      menuLayout: (patch.menuLayout ?? d.menuLayout) as MenuBrandingLayout,
      cardStyle: (patch.cardStyle ?? d.cardStyle) as MenuBrandingCardStyle,
      buttonStyle: (patch.buttonStyle ?? d.buttonStyle) as MenuBrandingButtonStyle,
      typography: (patch.typography ?? d.typography) as MenuBrandingTypography,
      colorMode: (patch.colorMode ?? d.colorMode) as PublicMenuBrandingTheme['colorMode'],
      primaryHex: patch.primaryHex ?? d.primaryHex,
      secondaryHex: patch.secondaryHex ?? d.secondaryHex,
      accentHex: patch.accentHex ?? d.accentHex,
    };
    return merged;
  }
  return {
    brandName: next.brandName ?? null,
    preset: next.preset as MenuBrandingPresetId,
    primaryHex: next.primaryHex,
    secondaryHex: next.secondaryHex,
    accentHex: next.accentHex,
    surface: next.surface as MenuBrandingSurface,
    menuLayout: next.menuLayout as MenuBrandingLayout,
    cardStyle: next.cardStyle as MenuBrandingCardStyle,
    buttonStyle: next.buttonStyle as MenuBrandingButtonStyle,
    typography: next.typography as MenuBrandingTypography,
    colorMode: next.colorMode as PublicMenuBrandingTheme['colorMode'],
  };
}
