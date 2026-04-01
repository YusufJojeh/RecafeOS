import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  LogoAnalysisResult,
  PublicMenuBrandingPayload,
  PublicMenuBrandingTheme,
} from '@restocafe/types';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { LogoAnalysisService } from './logo-analysis.service';
import {
  coalesceDraftTheme,
  mergeThemePatch,
  menuBrandingThemeSchema,
  patchMenuBrandingDraftSchema,
} from './menu-branding-tokens';
import { TenantLogoStorageService } from './tenant-logo-storage.service';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

@Injectable()
export class MenuBrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: TenantLogoStorageService,
    private readonly analysis: LogoAnalysisService,
  ) {}

  logoPublicUrl(tenantSlug: string, key: string): string {
    return `/api/v1/public/tenant-assets/logos/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(key)}`;
  }

  async getOrCreateRow(tenantId: string) {
    let row = await this.prisma.tenantMenuBranding.findUnique({
      where: { tenantId },
    });
    if (!row) {
      row = await this.prisma.tenantMenuBranding.create({
        data: { tenantId, draftJson: {} },
      });
    }
    return row;
  }

  async getState(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { slug: true },
    });
    const row = await this.getOrCreateRow(tenantId);
    const draft = coalesceDraftTheme(row.draftJson);
    const published = row.publishedJson
      ? coalesceDraftTheme(row.publishedJson)
      : null;
    const draftSnap = JSON.stringify({
      t: row.draftJson,
      k: row.logoDraftKey,
    });
    const pubSnap = JSON.stringify({
      t: row.publishedJson ?? {},
      k: row.logoPublishedKey,
    });
    const isDirty = draftSnap !== pubSnap;
    const lastAnalysis = row.logoAnalysisJson as LogoAnalysisResult | null;
    return {
      draft,
      published,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      isDirty,
      lastAnalysis,
      publishedLogoUrl: row.logoPublishedKey
        ? this.logoPublicUrl(tenant.slug, row.logoPublishedKey)
        : null,
      hasDraftLogo: Boolean(row.logoDraftKey),
    };
  }

  async getPublishedForPublicMenu(
    tenantId: string,
    tenantSlug: string,
  ): Promise<PublicMenuBrandingPayload | null> {
    const row = await this.prisma.tenantMenuBranding.findUnique({
      where: { tenantId },
    });
    if (!row?.publishedJson) return null;
    const theme = coalesceDraftTheme(row.publishedJson);
    const logoUrl = row.logoPublishedKey
      ? this.logoPublicUrl(tenantSlug, row.logoPublishedKey)
      : null;
    return { ...theme, logoUrl };
  }

  async patchDraft(
    tenantId: string,
    body: unknown,
  ): Promise<PublicMenuBrandingTheme> {
    const parsed = patchMenuBrandingDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const row = await this.getOrCreateRow(tenantId);
    const base = coalesceDraftTheme(row.draftJson);
    const next = mergeThemePatch(base, parsed.data);
    const checked = menuBrandingThemeSchema.safeParse(next);
    if (!checked.success) {
      throw new BadRequestException(checked.error.flatten());
    }
    await this.prisma.tenantMenuBranding.update({
      where: { tenantId },
      data: { draftJson: next as object },
    });
    return next;
  }

  async publish(tenantId: string) {
    const row = await this.getOrCreateRow(tenantId);
    const draft = coalesceDraftTheme(row.draftJson);
    await this.prisma.tenantMenuBranding.update({
      where: { tenantId },
      data: {
        publishedJson: draft as object,
        logoPublishedKey: row.logoDraftKey,
        publishedAt: new Date(),
      },
    });
    return this.getState(tenantId);
  }

  async uploadLogo(tenantId: string, buffer: Buffer, mime: string) {
    if (buffer.length > MAX_LOGO_BYTES) {
      throw new BadRequestException('Logo must be 2MB or smaller');
    }
    const allowed = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg',
    ]);
    if (!allowed.has(mime.toLowerCase())) {
      throw new BadRequestException('Use PNG, JPEG, or WebP');
    }
    let out: Buffer;
    try {
      out = await sharp(buffer)
        .rotate()
        .resize({
          width: 720,
          height: 720,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 88 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Could not process image');
    }
    const row = await this.getOrCreateRow(tenantId);
    if (row.logoDraftKey) {
      await this.storage.removeIfExists(tenantId, row.logoDraftKey);
    }
    const key = await this.storage.saveProcessedWebp(tenantId, out);
    await this.prisma.tenantMenuBranding.update({
      where: { tenantId },
      data: { logoDraftKey: key, logoAnalysisJson: Prisma.JsonNull },
    });
    return { logoDraftKey: key };
  }

  async deleteDraftLogo(tenantId: string): Promise<{ ok: true }> {
    const row = await this.getOrCreateRow(tenantId);
    if (row.logoDraftKey) {
      await this.storage.removeIfExists(tenantId, row.logoDraftKey);
    }
    await this.prisma.tenantMenuBranding.update({
      where: { tenantId },
      data: { logoDraftKey: null, logoAnalysisJson: Prisma.JsonNull },
    });
    return { ok: true };
  }

  async analyzeDraftLogo(tenantId: string): Promise<LogoAnalysisResult> {
    const row = await this.getOrCreateRow(tenantId);
    if (!row.logoDraftKey) {
      throw new BadRequestException('Upload a logo first');
    }
    const path = this.storage.resolveAbsolutePath(tenantId, row.logoDraftKey);
    let buf: Buffer;
    try {
      buf = await sharp(path).webp().toBuffer();
    } catch {
      throw new NotFoundException('Logo file missing');
    }
    const result = await this.analysis.analyze(buf);
    await this.prisma.tenantMenuBranding.update({
      where: { tenantId },
      data: { logoAnalysisJson: result as object },
    });
    return result;
  }

  async applyAnalysisSuggestions(tenantId: string) {
    const row = await this.getOrCreateRow(tenantId);
    const analysis = row.logoAnalysisJson as LogoAnalysisResult | null;
    if (!analysis) {
      throw new BadRequestException('Run logo analysis first');
    }
    const base = coalesceDraftTheme(row.draftJson);
    const hex6 = /^#[0-9A-Fa-f]{6}$/;
    const pick = (c: string | undefined, fb: string) =>
      c && hex6.test(c) ? c : fb;
    const proposal = analysis.paletteProposal;
    const sug = analysis.suggestions;
    const patch = {
      preset: analysis.suggestedPreset,
      primaryHex: pick(
        proposal?.primaryHex,
        pick(analysis.dominantColors[0], base.primaryHex),
      ),
      secondaryHex: pick(
        proposal?.secondaryHex,
        pick(analysis.dominantColors[1], base.secondaryHex),
      ),
      accentHex: pick(
        proposal?.accentHex,
        pick(analysis.dominantColors[2], base.accentHex),
      ),
      buttonStyle: sug?.buttonStyle ?? base.buttonStyle,
      cardStyle: sug?.cardStyle ?? base.cardStyle,
      menuLayout: sug?.menuDensity ?? base.menuLayout,
      typography: sug?.typography ?? base.typography,
    };
    const next = mergeThemePatch(base, patch);
    const checked = menuBrandingThemeSchema.safeParse(next);
    if (!checked.success) {
      throw new BadRequestException(checked.error.flatten());
    }
    await this.prisma.tenantMenuBranding.update({
      where: { tenantId },
      data: { draftJson: next as object },
    });
    return next;
  }

  async getDraftLogoBuffer(tenantId: string): Promise<Buffer> {
    const { readFile } = await import('node:fs/promises');
    const row = await this.getOrCreateRow(tenantId);
    if (!row.logoDraftKey) throw new NotFoundException();
    const p = this.storage.resolveAbsolutePath(tenantId, row.logoDraftKey);
    try {
      return await readFile(p);
    } catch {
      throw new NotFoundException();
    }
  }

  async assertPublishedLogo(
    tenantSlug: string,
    fileKey: string,
  ): Promise<{ tenantId: string; absolutePath: string }> {
    if (!this.storage.isSafeObjectKey(fileKey)) {
      throw new NotFoundException();
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        menuBranding: { select: { logoPublishedKey: true } },
      },
    });
    if (
      !tenant?.menuBranding?.logoPublishedKey ||
      tenant.menuBranding.logoPublishedKey !== fileKey
    ) {
      throw new NotFoundException();
    }
    return {
      tenantId: tenant.id,
      absolutePath: this.storage.resolveAbsolutePath(tenant.id, fileKey),
    };
  }
}
