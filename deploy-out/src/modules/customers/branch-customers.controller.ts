import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchCustomersQueryDto } from './dto/search-customers.query';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
@Controller('branches/:branchId/customers')
export class BranchCustomersController {
  constructor(private readonly customers: CustomersService) {}

  /** Customers who have visited this branch (for floor lookup). */
  @Get('search')
  @RequirePermissions('customers.view')
  searchAtBranch(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Query() query: SearchCustomersQueryDto,
  ) {
    return this.customers.searchAtBranch(
      req.user!.tenantId,
      branchId,
      query.q ?? '',
    );
  }

  @Get('visit-signals')
  @RequirePermissions('reports.view')
  visitSignals(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.customers.branchVisitSignals(req.user!.tenantId, branchId);
  }
}
