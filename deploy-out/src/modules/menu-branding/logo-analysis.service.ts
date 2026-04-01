import { Injectable } from '@nestjs/common';
import type {
  AccessibleColorPair,
  BrandToneHint,
  LogoAnalysisResult,
  MenuBrandingButtonStyle,
  MenuBrandingCardStyle,
  MenuBrandingLayout,
  MenuBrandingPresetId,
  MenuBrandingTypography,
  PaletteProposal,
  VisualIdentityEstimate,
} from '@restocafe/types';
import sharp from 'sharp';

const NEAR_BLACK = '#171717';
const LIGHT_SURFACE = '#FAFAFA';
const LIGHT_SURFACE_ALT = '#F4F4F5';
const WHITE = '#FFFFFF';
const DARK_SURFACE = '#0F172A';
const ON_DARK_TEXT = '#F8FAFC';
const MUTED_ON_LIGHT = '#52525B';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim();
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** WCAG 2.1 relative luminance (sRGB). */
function relativeLuminance(r255: number, g255: number, b255: number): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const R = lin(r255);
  const G = lin(g255);
  const B = lin(b255);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function luminanceFromHex(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return relativeLuminance(r, g, b);
}

/** Contrast ratio between two #RRGGBB colors (1–21). */
function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = luminanceFromHex(fgHex);
  const l2 = luminanceFromHex(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function pairMeta(
  foregroundHex: string,
  backgroundHex: string,
  usageKey: AccessibleColorPair['usageKey'],
  explanation: string,
): AccessibleColorPair {
  const ratio = Math.round(contrastRatio(foregroundHex, backgroundHex) * 100) / 100;
  return {
    foregroundHex,
    backgroundHex,
    ratio,
    meetsAaBodyText: ratio >= 4.5,
    meetsAaLargeText: ratio >= 3,
    meetsAaaBodyText: ratio >= 7,
    usageKey,
    explanation,
  };
}

/** Mix color toward black (t=1 → black). */
function mixTowardBlack(hex: string, t: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - t), g * (1 - t), b * (1 - t));
}

/** Ensure `fg` on `bg` meets minRatio; darkens `bg` if it is the lighter role for “button fill”. */
function darkenForContrastWithForeground(
  fillHex: string,
  fgHex: string,
  minRatio: number,
): string {
  let h = fillHex;
  for (let step = 0; step < 24; step += 1) {
    if (contrastRatio(fgHex, h) >= minRatio) return h;
    h = mixTowardBlack(h, 0.08);
  }
  return mixTowardBlack(fillHex, 0.85);
}

function simpleSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

function simpleLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

@Injectable()
export class LogoAnalysisService {
  async analyze(buffer: Buffer): Promise<LogoAnalysisResult> {
    const { data, info } = await sharp(buffer)
      .resize(64, 64, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
    let lumSum = 0;
    let satSum = 0;
    let hueVarAccum = 0;
    const pixels = info.width * info.height;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const qr = Math.floor(r / 24) * 24;
      const qg = Math.floor(g / 24) * 24;
      const qb = Math.floor(b / 24) * 24;
      const key = `${qr},${qg},${qb}`;
      const cur = buckets.get(key);
      if (cur) {
        cur.count += 1;
        cur.r += r;
        cur.g += g;
        cur.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
      lumSum += simpleLuminance(r, g, b);
      satSum += simpleSaturation(r, g, b);
      hueVarAccum += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
    }

    const sortedBuckets = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count);
    const dominantHexes = sortedBuckets.slice(0, 8).map(([, v]) => {
      const n = v.count;
      return rgbToHex(Math.round(v.r / n), Math.round(v.g / n), Math.round(v.b / n));
    });
    const dominantColors = [...new Set(dominantHexes)].slice(0, 5);

    const avgLum = lumSum / pixels;
    const avgSat = satSum / pixels;
    const hueActivity = hueVarAccum / (pixels * 255 * 3);

    const rawPrimary = dominantColors[0] ?? '#0D9488';
    const { r: pr, g: pg, b: pb } = hexToRgb(rawPrimary);
    const primLum = luminanceFromHex(rawPrimary);
    const ratioOnWhite = contrastRatio(rawPrimary, WHITE);
    const ratioOnBlack = contrastRatio(rawPrimary, NEAR_BLACK);

    let contrastRating: LogoAnalysisResult['contrastRating'] = 'adequate';
    let contrastNote =
      'The strongest logo swatch sits in a mid-contrast range; pair brand color with neutrals for long reading text (Arabic or Latin).';
    const bestVsExtremes = Math.max(
      contrastRatio(rawPrimary, WHITE),
      contrastRatio(rawPrimary, NEAR_BLACK),
    );
    if (bestVsExtremes < 3) {
      contrastRating = 'low';
      contrastNote =
        'Logo colors are close to mid-gray; avoid using them as small text. Use near-black on light surfaces (or light text on dark surfaces) for bilingual body copy.';
    } else if (bestVsExtremes >= 4.5) {
      contrastRating = 'strong';
      contrastNote =
        'Strong separation from white or near-black — suitable for labels and large UI if paired carefully.';
    }

    const ctaFill = darkenForContrastWithForeground(rawPrimary, WHITE, 4.5);
    const ctaRatio = contrastRatio(WHITE, ctaFill);

    const contrastPairs: AccessibleColorPair[] = [
      pairMeta(
        NEAR_BLACK,
        LIGHT_SURFACE,
        'body_on_light_surface',
        `Ratio ${contrastRatio(NEAR_BLACK, LIGHT_SURFACE).toFixed(2)}:1 — recommended default for menu descriptions and prices in Arabic or Latin on a light menu surface.`,
      ),
      pairMeta(
        ON_DARK_TEXT,
        DARK_SURFACE,
        'body_on_dark_surface',
        `Ratio ${contrastRatio(ON_DARK_TEXT, DARK_SURFACE).toFixed(2)}:1 — use if you publish a dark menu theme; same contrast rules apply to RTL and LTR text.`,
      ),
      pairMeta(
        MUTED_ON_LIGHT,
        LIGHT_SURFACE_ALT,
        'muted_on_light_surface',
        `Ratio ${contrastRatio(MUTED_ON_LIGHT, LIGHT_SURFACE_ALT).toFixed(2)}:1 — for secondary hints; still meets large-text AA if kept at supportive sizes.`,
      ),
      pairMeta(
        WHITE,
        ctaFill,
        'label_on_accent_button',
        `Ratio ${ctaRatio.toFixed(2)}:1 for white on adjusted fill — tuned toward AA for normal button labels; original swatch was ${rawPrimary === ctaFill ? 'already sufficient' : 'lightened/darkened for safety'}.`,
      ),
    ];

    const paletteProposal = this.buildPaletteProposal(
      dominantColors,
      rawPrimary,
      ctaFill,
    );

    const visualIdentity = this.scoreVisualIdentity(
      avgLum,
      avgSat,
      hueActivity,
      primLum,
      pr,
      pg,
      pb,
    );

    const brandTones = visualIdentity
      .filter((v) => v.score >= 45)
      .slice(0, 4)
      .map((v) => v.direction);

    const suggestedPreset = this.inferPreset(avgLum, avgSat, pr, pg, pb);
    const presetRationale = this.presetExplanation(
      suggestedPreset,
      avgLum,
      avgSat,
      pr,
      pg,
      pb,
    );

    const { suggestions } = this.styleSuggestions(
      suggestedPreset,
      visualIdentity,
      avgLum,
      avgSat,
    );

    const insightSummary = this.buildInsightSummary(
      visualIdentity[0]?.direction,
      suggestedPreset,
      contrastRating,
      paletteProposal,
    );

    return {
      dominantColors,
      contrastRating,
      contrastNote,
      contrastPairs,
      paletteProposal,
      visualIdentity,
      brandTones: brandTones.length ? brandTones : ['modern', 'casual'],
      suggestedPreset,
      presetRationale,
      insightSummary,
      suggestions,
    };
  }

  private buildPaletteProposal(
    dominantColors: string[],
    rawPrimary: string,
    ctaSafePrimary: string,
  ): PaletteProposal {
    const p0 = dominantColors[0] ?? rawPrimary;
    const p1 = dominantColors[1] ?? mixTowardBlack(p0, 0.15);
    const secondary = this.softWashFrom(p0);
    const accent = p1 !== p0 ? p1 : this.shiftHueWarm(p0);

    const primaryHex = ctaSafePrimary;
    const secondaryHex = secondary;
    const accentHex = rgbToHex(
      Math.min(255, hexToRgb(accent).r + 8),
      Math.min(255, hexToRgb(accent).g + 4),
      Math.min(255, hexToRgb(accent).b + 4),
    );

    return {
      primaryHex,
      secondaryHex,
      accentHex,
      rationale: `Primary is derived from the dominant sample (${p0}) and adjusted so white label text meets at least ~4.5:1 contrast. Secondary is a low-chroma wash for section backgrounds. Accent echoes a secondary cluster or a warm nudge for highlights.`,
      accessibilityNote:
        'Keep long text on light (#FAFAFA–#FFFFFF) or dark (#0F172A) surfaces with the suggested body pairs; brand primaries are suggested for accents and buttons, not dense paragraphs — works the same for Arabic and Latin shaping.',
    };
  }

  private softWashFrom(hex: string): string {
    const { r, g, b } = hexToRgb(hex);
    const t = 0.88;
    return rgbToHex(
      r + (255 - r) * t,
      g + (255 - g) * t,
      b + (255 - b) * t,
    );
  }

  private shiftHueWarm(hex: string): string {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex(Math.min(255, r + 18), Math.min(255, g + 6), b);
  }

  private scoreVisualIdentity(
    avgLum: number,
    avgSat: number,
    hueActivity: number,
    primLum: number,
    pr: number,
    pg: number,
    pb: number,
  ): VisualIdentityEstimate[] {
    const warmBias = (pr + Math.max(0, pr - pb) * 0.01) / 255;

    const score = (d: BrandToneHint): number => {
      let s = 0.2;
      switch (d) {
        case 'premium':
          s =
            (1 - avgSat) * 0.45 +
            (avgLum < 0.42 ? 0.25 : 0.1) +
            (primLum < 0.35 ? 0.2 : 0.05);
          break;
        case 'elegant':
          s =
            (1 - avgSat) * 0.35 +
            (avgLum > 0.28 && avgLum < 0.55 ? 0.25 : 0.1) +
            (hueActivity < 0.22 ? 0.2 : 0.05);
          break;
        case 'modern':
          s =
            (avgLum > 0.32 && avgLum < 0.68 ? 0.35 : 0.15) +
            (avgSat > 0.12 && avgSat < 0.38 ? 0.35 : 0.15) +
            (Math.abs(pg - pr) < 40 ? 0.15 : 0.05);
          break;
        case 'minimal':
          s = (1 - avgSat) * 0.55 + (avgLum > 0.52 ? 0.35 : 0.15);
          break;
        case 'playful':
          s = avgSat * 0.55 + hueActivity * 0.35 + (avgLum > 0.45 ? 0.1 : 0.05);
          break;
        case 'casual':
          s =
            avgSat * 0.4 +
            (avgLum > 0.38 && avgLum < 0.72 ? 0.3 : 0.15) +
            warmBias * 0.25;
          break;
        default:
          s = 0.2;
      }
      return s;
    };

    const dirs: BrandToneHint[] = [
      'premium',
      'elegant',
      'modern',
      'minimal',
      'playful',
      'casual',
    ];
    const raw = dirs.map((direction) => ({ direction, s: score(direction) }));
    const maxS = Math.max(...raw.map((x) => x.s), 1e-6);

    const explain = (d: BrandToneHint, s: number): string => {
      const pct = Math.round((s / maxS) * 100);
      switch (d) {
        case 'premium':
          return `Score ${pct}/100 — lower chroma and deeper average tone often read as restrained and high-end.`;
        case 'elegant':
          return `Score ${pct}/100 — balanced luminance with restrained saturation suggests refined, timeless styling.`;
        case 'modern':
          return `Score ${pct}/100 — mid contrast and controlled saturation fit contemporary digital menus.`;
        case 'minimal':
          return `Score ${pct}/100 — very soft saturation and brighter averages align with airy, sparse layouts.`;
        case 'playful':
          return `Score ${pct}/100 — higher saturation or color variety in the mark suggests energetic accents.`;
        case 'casual':
          return `Score ${pct}/100 — approachable warmth and moderate saturation read relaxed and friendly.`;
        default:
          return `Score ${pct}/100.`;
      }
    };

    return raw
      .map(({ direction, s }) => ({
        direction,
        score: Math.round((s / maxS) * 100),
        explanation: explain(direction, s),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private presetExplanation(
    preset: MenuBrandingPresetId,
    avgLum: number,
    avgSat: number,
    r: number,
    g: number,
    b: number,
  ): string {
    switch (preset) {
      case 'premium_fine':
        return 'Dark, low-chroma palette in the sample fits a low-glare, high-contrast fine-dining preset.';
      case 'bakery':
        return 'Warm, saturated tones lean toward bakery/dessert presets with cream surfaces.';
      case 'modern_cafe':
        return 'Fresh green/teal bias or balanced modern saturation suits a contemporary cafe baseline.';
      case 'minimal_cafe':
        return 'Very desaturated logo suggests a minimal typographic menu with flat surfaces.';
      case 'casual_dining':
        return 'Cooler or mid-blue bias maps well to a casual, approachable dining preset.';
      case 'classic_restaurant':
        return 'Warm neutrals with moderate saturation fit a classic, hospitable restaurant theme.';
      default:
        return `Chosen from average luminance ${avgLum.toFixed(2)} and saturation ${avgSat.toFixed(2)} (RGB ${r},${g},${b}).`;
    }
  }

  private styleSuggestions(
    preset: MenuBrandingPresetId,
    visualIdentity: VisualIdentityEstimate[],
    avgLum: number,
    avgSat: number,
  ): {
    buttonStyle: MenuBrandingButtonStyle;
    cardStyle: MenuBrandingCardStyle;
    menuLayout: MenuBrandingLayout;
    typography: MenuBrandingTypography;
    suggestions: LogoAnalysisResult['suggestions'];
  } {
    const top = visualIdentity[0]?.direction;
    const second = visualIdentity[1]?.direction;

    let buttonStyle: MenuBrandingButtonStyle = 'rounded';
    let buttonReason =
      'Rounded rectangles balance touch targets and a friendly default for mixed guest devices.';
    if (preset === 'premium_fine' || top === 'elegant' || top === 'premium') {
      buttonStyle = 'pill';
      buttonReason =
        'Pill buttons echo softer, premium service cues without sharp corners.';
    } else if (top === 'minimal' || preset === 'minimal_cafe') {
      buttonStyle = 'square';
      buttonReason =
        'Square corners reinforce a strict grid and minimal visual noise.';
    }

    let cardStyle: MenuBrandingCardStyle = 'elevated';
    let cardReason =
      'Light elevation separates dishes from the page while staying readable in sunlight.';
    if (preset === 'premium_fine' || top === 'elegant') {
      cardStyle = 'glass';
      cardReason =
        'Glass-style cards suggest depth and layering common in upscale digital menus.';
    } else if (top === 'minimal' || preset === 'minimal_cafe') {
      cardStyle = 'flat';
      cardReason =
        'Flat cards reduce shadow noise and keep focus on typography (works well in both RTL and LTR).';
    } else if (avgSat > 0.32 && (top === 'playful' || second === 'playful')) {
      cardStyle = 'bordered';
      cardReason =
        'Defined borders add structure when accent colors are energetic.';
    }

    let menuLayout: MenuBrandingLayout = 'standard';
    let headerReason =
      'Standard header density keeps category navigation visible above the fold on phones.';
    if (preset === 'premium_fine' || top === 'elegant') {
      menuLayout = 'featured_hero';
      headerReason =
        'Taller hero header gives whitespace for brand mark and bilingual title without crowding items.';
    } else if (top === 'minimal' || avgSat < 0.14) {
      menuLayout = 'compact';
      headerReason =
        'Compact header maximizes list space when the brand mark is visually quiet.';
    }

    let typography: MenuBrandingTypography = 'system';
    let typographyReason =
      'System UI stacks render reliably for Arabic and Latin without extra font downloads.';
    if (preset === 'classic_restaurant' || top === 'elegant') {
      typography = 'readable';
      typographyReason =
        'Serif-leaning readable stack can reinforce traditional dining; still use high-contrast body pairs.';
    } else if (top === 'premium' || preset === 'premium_fine') {
      typography = 'display_soft';
      typographyReason =
        'Softer display sans suits premium headers; keep body text on suggested high-contrast pairs.';
    }

    const paletteNote =
      'Proposal uses one adjusted brand fill plus a wash and accent — all optional until you save or publish.';
    const uiTone =
      avgLum < 0.4
        ? 'Favor dark surfaces or deep neutrals with light text, or lighten the menu theme and keep logos on light headers.'
        : 'Light airy surfaces with dark body text will stay accessible for long bilingual menus.';
    const heroStyle =
      menuLayout === 'featured_hero'
        ? 'Allow extra vertical space for logo and venue name; divider before categories.'
        : 'Keep header to logo + short helper line so RTL/LTR both align naturally.';
    const sectionEmphasis =
      avgSat > 0.3
        ? 'Use thin color bands or tinted chips for category titles.'
        : 'Prefer weight and tracking changes over heavy color blocks.';
    const imageTreatment =
      avgSat > 0.28
        ? 'Slightly warm, rounded item photos to match energetic brand color.'
        : 'Neutral photo treatment; let typography carry hierarchy.';

    return {
      buttonStyle,
      cardStyle,
      menuLayout,
      typography,
      suggestions: {
        paletteNote,
        uiTone,
        buttonStyle,
        buttonReason,
        cardStyle,
        cardReason,
        menuDensity: menuLayout,
        headerReason,
        typography,
        typographyReason,
        heroStyle,
        sectionEmphasis,
        imageTreatment,
      },
    };
  }

  private buildInsightSummary(
    topDirection: BrandToneHint | undefined,
    preset: MenuBrandingPresetId,
    contrast: LogoAnalysisResult['contrastRating'],
    proposal: PaletteProposal,
  ): string {
    const dir = topDirection ?? 'modern';
    return (
      `Dominant direction: ${dir}. Suggested preset: ${preset}. Contrast health: ${contrast}. ` +
      `Use ${proposal.primaryHex} for primary actions after your review; keep paragraphs on the suggested body/background pairs for WCAG-friendly reading in any script.`
    );
  }

  private inferPreset(
    avgLum: number,
    avgSat: number,
    r: number,
    g: number,
    b: number,
  ): MenuBrandingPresetId {
    if (avgLum < 0.38 && avgSat < 0.2) return 'premium_fine';
    if (avgSat > 0.32 && r > g + 15 && r > b + 10) return 'bakery';
    if (g > r + 8 && g > b + 8 && avgSat > 0.18) return 'modern_cafe';
    if (avgSat < 0.12) return 'minimal_cafe';
    if (b > r + 12 && b > g + 5) return 'casual_dining';
    if (avgLum > 0.55 && avgSat < 0.22) return 'classic_restaurant';
    return 'modern_cafe';
  }
}
