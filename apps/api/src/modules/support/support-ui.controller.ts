import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProvisioningService } from '../../provisioning/provisioning.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CloneMenuDto } from './dto/clone-menu.dto';
import { CreatePilotFeedbackDto } from './dto/create-pilot-feedback.dto';
import { CreatePilotWeeklySnapshotDto } from './dto/create-pilot-weekly-snapshot.dto';
import { CreateSupportTenantMemberDto } from './dto/create-support-tenant-member.dto';
import { PatchPilotFeedbackDto } from './dto/patch-pilot-feedback.dto';
import { PatchSupportCommerceDto } from './dto/patch-support-commerce.dto';
import { PatchSupportMetadataDto } from './dto/patch-support-metadata.dto';
import { PilotFeedbackListQueryDto } from './dto/pilot-feedback-list.query.dto';
import { PilotSnapshotsListQueryDto } from './dto/pilot-snapshots-list.query.dto';
import { PilotWeeklyReportQueryDto } from './dto/pilot-weekly-report.query.dto';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { ResetDemoDto } from './dto/reset-demo.dto';
import { SuspendTenantDto } from './dto/suspend-tenant.dto';
import { SupportAuditLogQueryDto } from './dto/support-audit-log.query.dto';
import { parseSupportOperatorHeader } from './support-operator.util';
import { SupportService } from './support.service';
import { SupportUiGuard } from './support-ui.guard';

@ApiTags('internal-support-ui')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SupportUiGuard)
@Controller('internal/support-ui')
export class SupportUiController {
  constructor(
    private readonly support: SupportService,
    private readonly provisioning: ProvisioningService,
  ) {}

  @Get('diagnostics')
  diagnostics() {
    return this.support.diagnostics();
  }

  @Get('pilots')
  listPilotPortfolio() {
    return this.support.listPilotPortfolio();
  }

  @Get('pilots/weekly-report')
  weeklyPilotReport(@Query() query: PilotWeeklyReportQueryDto) {
    return this.support.weeklyPilotReport(query.since);
  }

  @Get('pilots/snapshots')
  listPilotWeeklySnapshots(@Query() query: PilotSnapshotsListQueryDto) {
    return this.support.listPilotWeeklySnapshots({
      tenantId: query.tenantId,
      weekStart: query.weekStart,
    });
  }

  @Get('lookup/tenant-slug/:slug')
  tenantBySlug(@Param('slug') slug: string) {
    return this.support.tenantBySlug(slug);
  }

  @Get('tenants/:tenantId/summary')
  tenantSummary(@Param('tenantId') tenantId: string) {
    return this.support.tenantSummary(tenantId);
  }

  @Get('tenants/:tenantId/branches')
  listBranches(@Param('tenantId') tenantId: string) {
    return this.support.listBranchesForSupport(tenantId);
  }

  @Get('tenants/:tenantId/branches/:branchId/onboarding-status')
  onboardingStatusForSupport(
    @Param('tenantId') tenantId: string,
    @Param('branchId') branchId: string,
  ) {
    return this.support.getOnboardingStatusForSupport(tenantId, branchId);
  }

  @Get('tenants/:tenantId/audit-log')
  auditLog(
    @Param('tenantId') tenantId: string,
    @Query() query: SupportAuditLogQueryDto,
  ) {
    return this.support.listAuditLog(tenantId, {
      limit: query.limit,
      cursor: query.cursor,
      actionPrefix: query.actionPrefix,
      branchId: query.branchId,
    });
  }

  @Get('tenants/:tenantId/orders/:orderId')
  orderLookup(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.support.orderLookup(tenantId, orderId);
  }

  @Post('tenants/:tenantId/reset-demo')
  @HttpCode(200)
  resetDemo(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body() body: ResetDemoDto,
  ) {
    return this.provisioning.resetDemoBranch(tenantId, body.branchId, {
      acknowledgeProductionReset: body.acknowledgeProductionReset === true,
      supportOperator: parseSupportOperatorHeader(req),
    });
  }

  @Post('tenants/:tenantId/pilot-feedback')
  @HttpCode(201)
  createPilotFeedback(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body() dto: CreatePilotFeedbackDto,
  ) {
    return this.support.createPilotFeedback(
      tenantId,
      dto,
      parseSupportOperatorHeader(req),
    );
  }

  @Get('tenants/:tenantId/pilot-feedback')
  listPilotFeedback(
    @Param('tenantId') tenantId: string,
    @Query() query: PilotFeedbackListQueryDto,
  ) {
    return this.support.listPilotFeedback(tenantId, {
      limit: query.limit,
      feedbackType: query.feedbackType,
      status: query.status,
      promotedToEngineering: query.promotedToEngineering,
    });
  }

  @Patch('tenants/:tenantId/pilot-feedback/:feedbackId')
  patchPilotFeedback(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Param('feedbackId') feedbackId: string,
    @Body() dto: PatchPilotFeedbackDto,
  ) {
    return this.support.patchPilotFeedback(
      tenantId,
      feedbackId,
      dto,
      parseSupportOperatorHeader(req),
    );
  }

  @Post('tenants/:tenantId/pilot-weekly-snapshot')
  @HttpCode(200)
  upsertPilotWeeklySnapshot(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body() dto: CreatePilotWeeklySnapshotDto,
  ) {
    return this.support.upsertPilotWeeklySnapshot(
      tenantId,
      dto,
      parseSupportOperatorHeader(req),
    );
  }

  @Post('tenants/:tenantId/members')
  @HttpCode(201)
  addTenantMember(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateSupportTenantMemberDto,
  ) {
    return this.support.addTenantMember(
      tenantId,
      dto,
      parseSupportOperatorHeader(req),
    );
  }

  @Post('tenants/provision')
  @HttpCode(201)
  provisionTenant(@Req() req: Request, @Body() dto: ProvisionTenantDto) {
    return this.provisioning.provisionTenant({
      tenantName: dto.tenantName,
      tenantSlug: dto.tenantSlug,
      branchName: dto.branchName,
      branchSlug: dto.branchSlug,
      timezone: dto.timezone,
      currency: dto.currency,
      ownerEmail: dto.ownerEmail,
      ownerPassword: dto.ownerPassword,
      ownerDisplayName: dto.ownerDisplayName,
      includeSampleMenu: dto.includeSampleMenu !== false,
      tableCount: dto.tableCount ?? 2,
      trial: dto.trial,
      trialDays: dto.trialDays,
      supportOperator: parseSupportOperatorHeader(req),
    });
  }

  @Patch('tenants/:tenantId/commerce')
  patchCommerce(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body() dto: PatchSupportCommerceDto,
  ) {
    return this.support.patchCommerce(
      tenantId,
      dto,
      parseSupportOperatorHeader(req),
    );
  }

  @Post('tenants/:tenantId/suspend')
  @HttpCode(200)
  suspendTenant(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body() dto: SuspendTenantDto,
  ) {
    return this.support.suspendTenant(
      tenantId,
      dto,
      parseSupportOperatorHeader(req),
    );
  }

  @Post('tenants/:tenantId/reactivate')
  @HttpCode(200)
  reactivateTenant(@Req() req: Request, @Param('tenantId') tenantId: string) {
    return this.support.reactivateTenant(
      tenantId,
      parseSupportOperatorHeader(req),
    );
  }

  @Patch('tenants/:tenantId/metadata')
  patchMetadata(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body() dto: PatchSupportMetadataDto,
  ) {
    return this.support.patchMetadata(
      tenantId,
      dto,
      parseSupportOperatorHeader(req),
    );
  }

  @Get('tenants/:tenantId/invoice-export-readiness')
  invoiceExportReadiness(@Param('tenantId') tenantId: string) {
    return this.support.invoiceExportReadiness(tenantId);
  }

  @Post('jobs/expire-trials')
  @HttpCode(200)
  expireTrials() {
    return this.support.runExpireTrialsJob();
  }

  @Post('tenants/:tenantId/branches/:targetBranchId/clone-menu')
  @HttpCode(200)
  cloneMenu(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Param('targetBranchId') targetBranchId: string,
    @Body() dto: CloneMenuDto,
  ) {
    return this.support.cloneBranchMenu(
      tenantId,
      targetBranchId,
      dto,
      parseSupportOperatorHeader(req),
    );
  }
}
