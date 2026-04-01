import { Injectable } from '@nestjs/common';
import type {
  PilotFeedbackStatus,
  PilotFeedbackType,
} from '@prisma/client';
import type { CloneMenuDto } from './dto/clone-menu.dto';
import type { CreatePilotFeedbackDto } from './dto/create-pilot-feedback.dto';
import type { CreatePilotWeeklySnapshotDto } from './dto/create-pilot-weekly-snapshot.dto';
import type { CreateSupportTenantMemberDto } from './dto/create-support-tenant-member.dto';
import type { PatchPilotFeedbackDto } from './dto/patch-pilot-feedback.dto';
import type { PatchSupportCommerceDto } from './dto/patch-support-commerce.dto';
import type { PatchSupportMetadataDto } from './dto/patch-support-metadata.dto';
import type { SuspendTenantDto } from './dto/suspend-tenant.dto';
import { SupportDiagnosticsService } from './support-diagnostics.service';
import { SupportPilotService } from './support-pilot.service';
import { SupportTenantAdminService } from './support-tenant-admin.service';
import { SupportTenantLookupService } from './support-tenant-lookup.service';

export type { BranchRolloutEntry, PilotLimitationAck } from './support-metadata.model';
export {
  extractCommercialFromMetadata,
  extractPilotFromMetadata,
} from './support-metadata.model';

/** Facade: delegates to domain support services (single injection point for controllers). */
@Injectable()
export class SupportService {
  constructor(
    private readonly tenantLookup: SupportTenantLookupService,
    private readonly pilot: SupportPilotService,
    private readonly tenantAdmin: SupportTenantAdminService,
    private readonly diagnosticsSvc: SupportDiagnosticsService,
  ) {}

  listBranchesForSupport(tenantId: string) {
    return this.tenantLookup.listBranchesForSupport(tenantId);
  }

  getOnboardingStatusForSupport(tenantId: string, branchId: string) {
    return this.tenantLookup.getOnboardingStatusForSupport(tenantId, branchId);
  }

  tenantBySlug(slug: string) {
    return this.tenantLookup.tenantBySlug(slug);
  }

  tenantSummary(tenantId: string) {
    return this.tenantLookup.tenantSummary(tenantId);
  }

  listPilotPortfolio() {
    return this.pilot.listPilotPortfolio();
  }

  createPilotFeedback(
    tenantId: string,
    dto: CreatePilotFeedbackDto,
    createdByOperator?: string,
  ) {
    return this.pilot.createPilotFeedback(tenantId, dto, createdByOperator);
  }

  listPilotFeedback(
    tenantId: string,
    query: {
      limit?: number;
      feedbackType?: PilotFeedbackType;
      status?: PilotFeedbackStatus;
      promotedToEngineering?: boolean;
    },
  ) {
    return this.pilot.listPilotFeedback(tenantId, query);
  }

  patchPilotFeedback(
    tenantId: string,
    feedbackId: string,
    dto: PatchPilotFeedbackDto,
    supportOperator?: string,
  ) {
    return this.pilot.patchPilotFeedback(
      tenantId,
      feedbackId,
      dto,
      supportOperator,
    );
  }

  weeklyPilotReport(sinceRaw?: string) {
    return this.pilot.weeklyPilotReport(sinceRaw);
  }

  upsertPilotWeeklySnapshot(
    tenantId: string,
    dto: CreatePilotWeeklySnapshotDto,
    supportOperator?: string,
  ) {
    return this.pilot.upsertPilotWeeklySnapshot(
      tenantId,
      dto,
      supportOperator,
    );
  }

  listPilotWeeklySnapshots(query: {
    tenantId?: string;
    weekStart?: string;
  }) {
    return this.pilot.listPilotWeeklySnapshots(query);
  }

  patchCommerce(
    tenantId: string,
    dto: PatchSupportCommerceDto,
    supportOperator?: string,
  ) {
    return this.tenantAdmin.patchCommerce(tenantId, dto, supportOperator);
  }

  suspendTenant(
    tenantId: string,
    dto: SuspendTenantDto,
    supportOperator?: string,
  ) {
    return this.tenantAdmin.suspendTenant(tenantId, dto, supportOperator);
  }

  reactivateTenant(tenantId: string, supportOperator?: string) {
    return this.tenantAdmin.reactivateTenant(tenantId, supportOperator);
  }

  patchMetadata(
    tenantId: string,
    dto: PatchSupportMetadataDto,
    supportOperator?: string,
  ) {
    return this.tenantAdmin.patchMetadata(tenantId, dto, supportOperator);
  }

  invoiceExportReadiness(tenantId: string) {
    return this.diagnosticsSvc.invoiceExportReadiness(tenantId);
  }

  runExpireTrialsJob() {
    return this.tenantAdmin.runExpireTrialsJob();
  }

  diagnostics() {
    return this.diagnosticsSvc.diagnostics();
  }

  orderLookup(tenantId: string, orderId: string) {
    return this.diagnosticsSvc.orderLookup(tenantId, orderId);
  }

  addTenantMember(
    tenantId: string,
    dto: CreateSupportTenantMemberDto,
    supportOperator?: string,
  ) {
    return this.tenantAdmin.addTenantMember(tenantId, dto, supportOperator);
  }

  cloneBranchMenu(
    tenantId: string,
    targetBranchId: string,
    dto: CloneMenuDto,
    supportOperator?: string,
  ) {
    return this.tenantAdmin.cloneBranchMenu(
      tenantId,
      targetBranchId,
      dto,
      supportOperator,
    );
  }

  listAuditLog(
    tenantId: string,
    query: {
      limit?: number;
      cursor?: string;
      actionPrefix?: string;
      branchId?: string;
    },
  ) {
    return this.diagnosticsSvc.listAuditLog(tenantId, query);
  }
}
