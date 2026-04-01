import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BranchesService } from './branches.service';
import { GoLiveAckDto } from './dto/go-live-ack.dto';
import { PatchBranchDto } from './dto/patch-branch.dto';
import { PatchOnboardingUiDto } from './dto/patch-onboarding-ui.dto';

@ApiTags('branches')
@ApiBearerAuth()
@Controller('tenants/branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: Request) {
    return this.branches.listForTenant(req.user!.tenantId);
  }

  /** Readiness for any authenticated branch member (e.g. Floor banner). */
  @Get(':branchId/setup-readiness')
  @UseGuards(JwtAuthGuard, BranchGuard)
  setupReadiness(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.branches.getSetupReadiness(req.user!.tenantId, branchId);
  }

  /** Ops snapshot (setup + low-stock count + open shift) for any branch member. */
  @Get(':branchId/ops-snapshot')
  @UseGuards(JwtAuthGuard, BranchGuard)
  opsSnapshot(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.branches.getOpsSnapshot(req.user!.tenantId, branchId);
  }

  @Get(':branchId/onboarding-status')
  @UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
  @RequirePermissions('settings.manage')
  onboardingStatus(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.branches.getOnboardingStatus(req.user!.tenantId, branchId);
  }

  /** Plan limits, branch flags, and deployment URL health for setup (read-only). */
  @Get(':branchId/config-snapshot')
  @UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
  @RequirePermissions('settings.manage')
  configSnapshot(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.branches.getConfigSnapshot(req.user!.tenantId, branchId);
  }

  @Patch(':branchId')
  @UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
  @RequirePermissions('settings.manage')
  patchBranch(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() dto: PatchBranchDto,
  ) {
    return this.branches.patchBranchSafe(
      req.user!.tenantId,
      branchId,
      req.user!.userId,
      dto,
    );
  }

  @Patch(':branchId/onboarding-ui')
  @UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
  @RequirePermissions('settings.manage')
  patchOnboardingUi(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() dto: PatchOnboardingUiDto,
  ) {
    return this.branches.patchOnboardingUi(
      req.user!.tenantId,
      branchId,
      req.user!.userId,
      dto,
    );
  }

  @Post(':branchId/go-live-ack')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
  @RequirePermissions('settings.manage')
  goLiveAck(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() dto: GoLiveAckDto,
  ) {
    return this.branches.acknowledgeGoLive(
      req.user!.tenantId,
      branchId,
      req.user!.userId,
      dto.confirm,
    );
  }
}
