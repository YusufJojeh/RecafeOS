import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddRecipeDto } from './dto/add-recipe.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
@Controller('branches/:branchId/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('stock')
  @RequirePermissions('stock.manage')
  list(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.inventory.list(branchId, req.user!.tenantId);
  }

  @Post('adjust')
  @HttpCode(200)
  @RequirePermissions('stock.manage')
  adjust(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: AdjustStockDto,
  ) {
    return this.inventory.adjust(
      branchId,
      req.user!.tenantId,
      req.user!.userId,
      body,
    );
  }

  @Post('recipes')
  @RequirePermissions('stock.manage')
  recipe(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: AddRecipeDto,
  ) {
    return this.inventory.addRecipe(branchId, req.user!.tenantId, body);
  }
}
