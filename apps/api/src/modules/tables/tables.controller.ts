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
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTableDto } from './dto/create-table.dto';
import { MergeSessionsDto } from './dto/merge-sessions.dto';
import { OpenSessionDto } from './dto/open-session.dto';
import { PatchTableDto } from './dto/patch-table.dto';
import { TablesService } from './tables.service';

@ApiTags('tables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
@Controller('branches/:branchId/tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get()
  @RequirePermissions('tables.manage')
  list(@Param('branchId') branchId: string, @Req() req: Request) {
    return this.tables.listTables(branchId, req.user!.tenantId);
  }

  @Post()
  @RequirePermissions('tables.manage')
  create(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: CreateTableDto,
  ) {
    return this.tables.createTable(branchId, req.user!.tenantId, body);
  }

  @Patch(':tableId')
  @RequirePermissions('tables.manage')
  patch(
    @Param('branchId') branchId: string,
    @Param('tableId') tableId: string,
    @Req() req: Request,
    @Body() body: PatchTableDto,
  ) {
    return this.tables.patchTable(branchId, req.user!.tenantId, tableId, body);
  }

  @Post('sessions')
  @HttpCode(200)
  @RequirePermissions('tables.manage')
  openSession(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: OpenSessionDto,
  ) {
    return this.tables.openSession(branchId, req.user!.tenantId, body);
  }

  @Post('sessions/merge')
  @HttpCode(200)
  @RequirePermissions('tables.manage')
  merge(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: MergeSessionsDto,
  ) {
    return this.tables.mergeSessions(
      branchId,
      req.user!.tenantId,
      body.targetSessionId,
      body.sourceSessionId,
    );
  }
}
