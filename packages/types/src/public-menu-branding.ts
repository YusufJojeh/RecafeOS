/** Bounded design tokens for tenant public (QR) menu — no raw CSS. */

export const MENU_BRANDING_PRESET_IDS = [
  'classic_restaurant',
  'premium_fine',
  'modern_cafe',
  'minimal_cafe',
  'bakery',
  'casual_dining',
] as const;
export type MenuBrandingPresetId = (typeof MENU_BRANDING_PRESET_IDS)[number];

export const MENU_BRANDING_SURFACES = [
  'soft_neutral',
  'warm_cream',
  'cool_slate',
  'deep_contrast',
] as const;
export type MenuBrandingSurface = (typeof MENU_BRANDING_SURFACES)[number];

export const MENU_BRANDING_LAYOUTS = [
  'standard',
  'compact',
  'featured_hero',
] as const;
export type MenuBrandingLayout = (typeof MENU_BRANDING_LAYOUTS)[number];

export const MENU_BRANDING_CARD_STYLES = [
  'elevated',
  'flat',
  'bordered',
  'glass',
] as const;
export type MenuBrandingCardStyle = (typeof MENU_BRANDING_CARD_STYLES)[number];

export const MENU_BRANDING_BUTTON_STYLES = [
  'pill',
  'rounded',
  'square',
] as const;
export type MenuBrandingButtonStyle = (typeof MENU_BRANDING_BUTTON_STYLES)[number];

export const MENU_BRANDING_TYPOGRAPHY = [
  'system',
  'readable',
  'display_soft',
] as const;
export type MenuBrandingTypography = (typeof MENU_BRANDING_TYPOGRAPHY)[number];

export const MENU_BRANDING_COLOR_MODES = ['light', 'dark'] as const;
export type MenuBrandingColorMode = (typeof MENU_BRANDING_COLOR_MODES)[number];

export type BrandToneHint =
  | 'premium'
  | 'modern'
  | 'playful'
  | 'minimal'
  | 'elegant'
  | 'casual';

/** Persisted / API theme shape (logo URL added when resolving for clients). */
export type PublicMenuBrandingTheme = {
  brandName: string | null;
  preset: MenuBrandingPresetId;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  surface: MenuBrandingSurface;
  menuLayout: MenuBrandingLayout;
  cardStyle: MenuBrandingCardStyle;
  buttonStyle: MenuBrandingButtonStyle;
  typography: MenuBrandingTypography;
  colorMode: MenuBrandingColorMode;
};

/** Payload embedded in public menu responses. */
export type PublicMenuBrandingPayload = PublicMenuBrandingTheme & {
  logoUrl: string | null;
};

/** WCAG 2.1 contrast ratio between two sRGB hex colors (rounded). */
export type AccessibleColorPair = {
  foregroundHex: string;
  backgroundHex: string;
  /** Contrast ratio (1–21). */
  ratio: number;
  /** Normal text, approx. under 18pt (AA = 4.5:1). */
  meetsAaBodyText: boolean;
  /** Large text / bold UI chrome (AA = 3:1). */
  meetsAaLargeText: boolean;
  /** Normal text AAA (7:1). */
  meetsAaaBodyText: boolean;
  /** Stable semantic tag for i18n (e.g. body_on_light_surface). */
  usageKey:
    | 'body_on_light_surface'
    | 'body_on_dark_surface'
    | 'label_on_accent_button'
    | 'muted_on_light_surface';
  /** Short English rationale; UI may translate by usageKey + metrics. */
  explanation: string;
};

/** Suggested palette — hints only; tenant confirms in the editor. */
export type PaletteProposal = {
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  /** Why these three were chosen from the sample. */
  rationale: string;
  /** How this stays readable for Arabic/Latin body copy and UI. */
  accessibilityNote: string;
};

export type VisualIdentityEstimate = {
  direction: BrandToneHint;
  /** 0–100 relative strength vs other directions (heuristic). */
  score: number;
  explanation: string;
};

export type LogoAnalysisResult = {
  dominantColors: string[];
  contrastRating: 'low' | 'adequate' | 'strong';
  contrastNote: string;
  /** Ranked pairs safe for body, surfaces, and accent UI (suggestions only). */
  contrastPairs: AccessibleColorPair[];
  /** Controlled three-color proposal derived from logo + contrast guardrails. */
  paletteProposal: PaletteProposal;
  /** Six directions scored and explained; order is descending score. */
  visualIdentity: VisualIdentityEstimate[];
  /** Legacy quick tags (subset of directions). */
  brandTones: BrandToneHint[];
  suggestedPreset: MenuBrandingPresetId;
  /** Why this preset fits the sample (plain language). */
  presetRationale: string;
  /** One-sentence overview for staff (language-neutral numerically; English prose). */
  insightSummary: string;
  suggestions: {
    paletteNote: string;
    uiTone: string;
    buttonStyle: MenuBrandingButtonStyle;
    buttonReason: string;
    cardStyle: MenuBrandingCardStyle;
    cardReason: string;
    menuDensity: MenuBrandingLayout;
    headerReason: string;
    typography: MenuBrandingTypography;
    typographyReason: string;
    heroStyle: string;
    sectionEmphasis: string;
    imageTreatment: string;
  };
};
