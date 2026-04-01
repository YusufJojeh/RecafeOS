import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createReadStream } from 'node:fs';
import { MenuBrandingService } from './menu-branding.service';
import { PublicSlugPipe } from '../public/pipes/public-route-params.pipe';

@ApiTags('public')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('public/tenant-assets')
export class PublicTenantAssetsController {
  constructor(private readonly branding: MenuBrandingService) {}

  @Get('logos/:tenantSlug/:fileKey')
  @ApiOkResponse({ description: 'Published tenant logo (WebP).' })
  @ApiNotFoundResponse({ description: 'Unknown slug, file, or not published.' })
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  @Header('Cache-Control', 'public, max-age=86400, immutable')
  async publishedLogo(
    @Param('tenantSlug', PublicSlugPipe) tenantSlug: string,
    @Param('fileKey') fileKey: string,
  ): Promise<StreamableFile> {
    try {
      const { absolutePath } = await this.branding.assertPublishedLogo(
        tenantSlug,
        fileKey,
      );
      return new StreamableFile(createReadStream(absolutePath), {
        type: 'image/webp',
        disposition: 'inline',
      });
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new NotFoundException();
    }
  }
}
