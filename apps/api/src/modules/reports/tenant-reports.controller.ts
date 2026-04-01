import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ArchiveStaleVisitsQueryDto } from './dto/archive-stale-visits.query';
import { BranchSnapshotQueryDto } from './dto/branch-snapshot.query';
import { RepeatCustomersQueryDto } from './dto/repeat-customers.query';
import { TenantRollupQueryDto } from './dto/tenant-rollup.query';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tenants/reports')
export class TenantReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('tenant-rollup')
  @ApiOperation({
    summary: 'Tenant rollup (read-only, multi-branch KPIs)',
    description:
      'Aggregates paid orders across up to min(plan max branches, 25) branches for the tenant. ' +
      'Uses a UTC inclusive calendar range for `paidAt` — see response `semantics`. ' +
      'Requires `reports.tenant_rollups` (owner/manager by default).',
  })
  @RequirePermissions('reports.tenant_rollups')
  tenantRollup(@Req() req: Request, @Query() query: TenantRollupQueryDto) {
    return this.reports.tenantRollup(req.user!.tenantId, query.from, query.to);
  }

  @Get('branch-snapshot')
  @ApiOperation({
    summary: 'Per-branch local-day snapshot (fair multi-site compare)',
    description:
      'Net paid sales for one calendar date in each branch’s own timezone. ' +
      'Requires `reports.tenant_rollups`.',
  })
  @RequirePermissions('reports.tenant_rollups')
  branchSnapshot(@Req() req: Request, @Query() query: BranchSnapshotQueryDto) {
    return this.reports.branchLocalDaySnapshot(req.user!.tenantId, query.date);
  }

  @Get('repeat-customers')
  @ApiOperation({
    summary: 'Repeat customer spend (rolling window, tenant scope)',
    description:
      'Top customers by net paid sales in the window; requires `reports.tenant_rollups`.',
  })
  @RequirePermissions('reports.tenant_rollups')
  repeatCustomers(
    @Req() req: Request,
    @Query() query: RepeatCustomersQueryDto,
  ) {
    return this.reports.repeatCustomersRollup(req.user!.tenantId, query.days);
  }

  @Post('archive-stale-customer-visits')
  @ApiOperation({
    summary: 'Delete old customer visit rows (retention housekeeping)',
    description:
      'Deletes `CustomerVisit` records older than `years` (default 7), then recomputes ' +
      '`Customer.visitCount` for the tenant. Requires `reports.tenant_rollups`.',
  })
  @RequirePermissions('reports.tenant_rollups')
  archiveStaleCustomerVisits(
    @Req() req: Request,
    @Query() query: ArchiveStaleVisitsQueryDto,
  ) {
    return this.reports.archiveStaleCustomerVisits(
      req.user!.tenantId,
      query.years,
    );
  }
}
