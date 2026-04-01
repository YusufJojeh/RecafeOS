import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DailyReportQueryDto } from './dto/daily-report.query';
import { DemandProfileQueryDto } from './dto/demand-profile.query';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
@Controller('branches/:branchId/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('daily')
  @RequirePermissions('reports.view')
  daily(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Query() query: DailyReportQueryDto,
  ) {
    return this.reports.daily(branchId, req.user!.tenantId, query.date);
  }

  /** Last 7 local days vs prior week + setup + one highlight (owner habit screen). */
  @Get('weekly-digest')
  @RequirePermissions('reports.view')
  weeklyDigest(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.reports.weeklyBranchDigest(branchId, req.user!.tenantId);
  }

  /** Rolling hour-of-day demand (staffing / prep peak band). */
  @Get('demand-profile')
  @RequirePermissions('reports.view')
  demandProfile(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Query() query: DemandProfileQueryDto,
  ) {
    return this.reports.demandProfile(branchId, req.user!.tenantId, query.days);
  }
}
