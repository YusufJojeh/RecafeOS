import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MenuBrandingService } from './menu-branding.service';

const LOGO_UPLOAD_LIMIT = 2 * 1024 * 1024;

@ApiTags('menu-branding')
@ApiBearerAuth()
@Controller('tenants/menu-branding')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MenuBrandingController {
  constructor(private readonly branding: MenuBrandingService) {}

  @Get()
  @RequirePermissions('settings.manage')
  @ApiOkResponse({ description: 'Draft + published menu branding state.' })
  state(@Req() req: Request) {
    return this.branding.getState(req.user!.tenantId);
  }

  @Patch('draft')
  @RequirePermissions('settings.manage')
  patchDraft(@Req() req: Request, @Body() body: unknown) {
    return this.branding.patchDraft(req.user!.tenantId, body);
  }

  @Post('publish')
  @HttpCode(200)
  @RequirePermissions('settings.manage')
  publish(@Req() req: Request) {
    return this.branding.publish(req.user!.tenantId);
  }

  @Post('logo')
  @HttpCode(200)
  @RequirePermissions('settings.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: LOGO_UPLOAD_LIMIT },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  async uploadLogo(
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    return this.branding.uploadLogo(req.user!.tenantId, file.buffer, file.mimetype);
  }

  @Delete('logo')
  @HttpCode(200)
  @RequirePermissions('settings.manage')
  deleteLogo(@Req() req: Request) {
    return this.branding.deleteDraftLogo(req.user!.tenantId);
  }

  @Post('analyze-logo')
  @HttpCode(200)
  @RequirePermissions('settings.manage')
  analyzeLogo(@Req() req: Request) {
    return this.branding.analyzeDraftLogo(req.user!.tenantId);
  }

  @Post('apply-analysis')
  @HttpCode(200)
  @RequirePermissions('settings.manage')
  applyAnalysis(@Req() req: Request) {
    return this.branding.applyAnalysisSuggestions(req.user!.tenantId);
  }

  @Get('draft-logo')
  @RequirePermissions('settings.manage')
  @ApiOkResponse({ description: 'Draft logo bytes (WebP).' })
  async draftLogo(@Req() req: Request): Promise<StreamableFile> {
    const buf = await this.branding.getDraftLogoBuffer(req.user!.tenantId);
    return new StreamableFile(buf, {
      type: 'image/webp',
      disposition: 'inline',
    });
  }
}
