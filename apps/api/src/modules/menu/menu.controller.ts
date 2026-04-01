import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequireAnyPermissions } from '../../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddModifierOptionDto } from './dto/add-modifier-option.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateModifierGroupDto } from './dto/create-modifier-group.dto';
import { MenuImportPayloadDto } from './dto/menu-import.dto';
import { PatchMenuItemDto } from './dto/patch-menu-item.dto';
import { MenuService } from './menu.service';

@ApiTags('menu')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
@Controller('branches/:branchId/menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  /** Read-only catalog for ordering UIs; mutating routes remain `menu.manage` only. */
  @Get('categories')
  @RequireAnyPermissions('menu.read', 'menu.manage', 'orders.create')
  categories(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.menu.categories(branchId, req.user!.tenantId);
  }

  @Post('categories')
  @RequirePermissions('menu.manage')
  createCat(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: CreateCategoryDto,
  ) {
    return this.menu.createCategory(branchId, req.user!.tenantId, body);
  }

  @Post('items')
  @RequirePermissions('menu.manage')
  createItem(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: CreateMenuItemDto,
  ) {
    return this.menu.createItem(branchId, req.user!.tenantId, body);
  }

  @Patch('items/:itemId')
  @RequirePermissions('menu.manage')
  patchItem(
    @Param('branchId') branchId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @Body() body: PatchMenuItemDto,
  ) {
    return this.menu.patchItem(branchId, req.user!.tenantId, itemId, body);
  }

  @Post('modifier-groups')
  @RequirePermissions('menu.manage')
  modGroup(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: CreateModifierGroupDto,
  ) {
    return this.menu.createModifierGroup(branchId, req.user!.tenantId, body);
  }

  @Post('modifier-groups/:groupId/options')
  @RequirePermissions('menu.manage')
  modOpt(
    @Param('branchId') branchId: string,
    @Param('groupId') groupId: string,
    @Req() req: Request,
    @Body() body: AddModifierOptionDto,
  ) {
    return this.menu.addModifierOption(
      groupId,
      branchId,
      req.user!.tenantId,
      body,
    );
  }

  @Post('items/:itemId/modifier-groups/:groupId')
  @RequirePermissions('menu.manage')
  link(
    @Param('branchId') branchId: string,
    @Param('itemId') itemId: string,
    @Param('groupId') groupId: string,
    @Req() req: Request,
  ) {
    return this.menu.linkModifierToItem(
      itemId,
      groupId,
      branchId,
      req.user!.tenantId,
    );
  }

  @Post('import/dry-run')
  @RequirePermissions('menu.manage')
  importDryRun(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: MenuImportPayloadDto,
  ) {
    return this.menu.importDryRun(branchId, req.user!.tenantId, body);
  }

  @Post('import/apply')
  @RequirePermissions('menu.manage')
  importApply(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: MenuImportPayloadDto,
  ) {
    return this.menu.importApply(
      branchId,
      req.user!.tenantId,
      req.user!.userId,
      body,
    );
  }
}
