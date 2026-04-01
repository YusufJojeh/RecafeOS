import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DailyReportQueryDto } from '../reports/dto/daily-report.query';
import { AiInsightsService } from './ai-insights.service';

/** Stricter than default API throttle (120/min). */
@Throttle({ default: { limit: 15, ttl: 60_000 } })
@ApiTags('ai-insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
@Controller('branches/:branchId/insights')
export class AiInsightsController {
  constructor(private readonly insights: AiInsightsService) {}

  @Get('daily-summary')
  @ApiOperation({
    summary:
      'Optional AI narrative for the daily report (read-only; requires tenant opt-in)',
  })
  @RequirePermissions('insights.generate')
  dailySummary(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Query() query: DailyReportQueryDto,
  ) {
    return this.insights.dailySummaryExplanation(
      branchId,
      req.user!.tenantId,
      query.date,
    );
  }

  @Get('weekly-digest')
  @ApiOperation({
    summary:
      'Optional AI narrative on top of the existing weekly digest metrics (read-only; advisory)',
  })
  @RequirePermissions('insights.generate')
  weeklyDigest(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.insights.weeklyDigestNarrative(branchId, req.user!.tenantId);
  }

  @Get('low-stock')
  @ApiOperation({
    summary:
      'Commentary on low-stock rows from the daily report (thresholds are system-owned)',
  })
  @RequirePermissions('insights.generate')
  lowStock(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Query() query: DailyReportQueryDto,
  ) {
    return this.insights.lowStockCommentary(
      branchId,
      req.user!.tenantId,
      query.date,
    );
  }

  @Get('underperforming-items')
  @ApiOperation({
    summary:
      'Deterministic underperformer shortlist with optional AI explanation (historical comparison only)',
  })
  @RequirePermissions('insights.generate')
  underperformingItems(
    @Param('branchId') branchId: string,
    @Req() req: Request,
  ) {
    return this.insights.underperformingItemsNarrative(
      branchId,
      req.user!.tenantId,
    );
  }

  @Get('branch-compare')
  @ApiOperation({
    summary:
      'Narrative comparing branches on the same local calendar date (tenant-scoped data; advisory)',
  })
  @RequirePermissions('insights.generate')
  branchCompare(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Query() query: DailyReportQueryDto,
  ) {
    return this.insights.branchCompareCommentary(
      branchId,
      req.user!.tenantId,
      query.date,
    );
  }
}
