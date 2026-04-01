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
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProvisioningService } from '../../provisioning/provisioning.service';
import { PatchSupportCommerceDto } from './dto/patch-support-commerce.dto';
import { CreatePilotFeedbackDto } from './dto/create-pilot-feedback.dto';
import { PatchSupportMetadataDto } from './dto/patch-support-metadata.dto';
import { CreatePilotWeeklySnapshotDto } from './dto/create-pilot-weekly-snapshot.dto';
import { PatchPilotFeedbackDto } from './dto/patch-pilot-feedback.dto';
import { PilotFeedbackListQueryDto } from './dto/pilot-feedback-list.query.dto';
import { PilotSnapshotsListQueryDto } from './dto/pilot-snapshots-list.query.dto';
import { PilotWeeklyReportQueryDto } from './dto/pilot-weekly-report.query.dto';
import { CloneMenuDto } from './dto/clone-menu.dto';
import { CreateSupportTenantMemberDto } from './dto/create-support-tenant-member.dto';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { ResetDemoDto } from './dto/reset-demo.dto';
import { SuspendTenantDto } from './dto/suspend-tenant.dto';
import { SupportAuditLogQueryDto } from './dto/support-audit-log.query.dto';
import { SupportAccess } from './support-access.decorator';
import { SupportApiKeyGuard } from './support-api-key.guard';
import { parseSupportOperatorHeader } from './support-operator.util';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiHeader({ name: 'x-support-api-key', required: true })
@ApiHeader({
  name: 'x-support-operator',
  required: false,
  description: 'Optional operator id for audit metadata on mutating routes',
})
@UseGuards(SupportApiKeyGuard)
@Controller('support')
export class SupportController {
  constructor(
    private readonly support: SupportService,
    private readonly provisioning: ProvisioningService,
  ) {}

  @Get('diagnostics')
  @SupportAccess('read')
  diagnostics() {
    return this.support.diagnostics();
  }

  /** Portfolio: tenants tagged `metadata.commercialEngagement` = pilot. */
  @Get('pilots')
  @SupportAccess('read')
  listPilotPortfolio() {
    return this.support.listPilotPortfolio();
  }

  @Get('pilots/weekly-report')
  @SupportAccess('read')
  weeklyPilotReport(@Query() query: PilotWeeklyReportQueryDto) {
    return this.support.weeklyPilotReport(query.since);
  }

  @Get('pilots/snapshots')
  @SupportAccess('read')
  listPilotWeeklySnapshots(@Query() query: PilotSnapshotsListQueryDto) {
    return this.support.listPilotWeeklySnapshots({
      tenantId: query.tenantId,
      weekStart: query.weekStart,
    });
  }

  @Post('tenants/:tenantId/members')
  @HttpCode(201)
  @SupportAccess('write')
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
  @SupportAccess('write')
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
  @SupportAccess('write')
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
  @SupportAccess('write')
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
  @SupportAccess('write')
  reactivateTenant(@Req() req: Request, @Param('tenantId') tenantId: string) {
    return this.support.reactivateTenant(
      tenantId,
      parseSupportOperatorHeader(req),
    );
  }

  @Patch('tenants/:tenantId/metadata')
  @SupportAccess('write')
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
  @SupportAccess('read')
  invoiceExportReadiness(@Param('tenantId') tenantId: string) {
    return this.support.invoiceExportReadiness(tenantId);
  }

  @Post('jobs/expire-trials')
  @HttpCode(200)
  @SupportAccess('write')
  expireTrials() {
    return this.support.runExpireTrialsJob();
  }

  @Post('tenants/:tenantId/reset-demo')
  @HttpCode(200)
  @SupportAccess('write')
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

  /** Resolve tenant id from slug (for support console and scripts). */
  @Get('lookup/tenant-slug/:slug')
  @SupportAccess('read')
  tenantBySlug(@Param('slug') slug: string) {
    return this.support.tenantBySlug(slug);
  }

  @Get('tenants/:tenantId/summary')
  @SupportAccess('read')
  tenantSummary(@Param('tenantId') tenantId: string) {
    return this.support.tenantSummary(tenantId);
  }

  @Post('tenants/:tenantId/pilot-feedback')
  @HttpCode(201)
  @SupportAccess('write')
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
  @SupportAccess('read')
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
  @SupportAccess('write')
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
  @SupportAccess('write')
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

  @Get('tenants/:tenantId/branches')
  @SupportAccess('read')
  listBranches(@Param('tenantId') tenantId: string) {
    return this.support.listBranchesForSupport(tenantId);
  }

  @Get('tenants/:tenantId/branches/:branchId/onboarding-status')
  @SupportAccess('read')
  onboardingStatusForSupport(
    @Param('tenantId') tenantId: string,
    @Param('branchId') branchId: string,
  ) {
    return this.support.getOnboardingStatusForSupport(tenantId, branchId);
  }

  @Post('tenants/:tenantId/branches/:targetBranchId/clone-menu')
  @HttpCode(200)
  @SupportAccess('write')
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

  @Get('tenants/:tenantId/audit-log')
  @SupportAccess('read')
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
  @SupportAccess('read')
  orderLookup(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.support.orderLookup(tenantId, orderId);
  }
}
