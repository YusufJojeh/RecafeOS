import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AddCustomerNoteDto } from './dto/add-customer-note.dto';
import { AddOfferDto } from './dto/add-offer.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { PatchCustomerDto } from './dto/patch-customer.dto';
import { SearchCustomersQueryDto } from './dto/search-customers.query';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('search')
  @RequirePermissions('customers.view')
  search(@Req() req: Request, @Query() query: SearchCustomersQueryDto) {
    return this.customers.search(req.user!.tenantId, query.q ?? '');
  }

  @Get(':id')
  @RequirePermissions('customers.view')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.customers.get(req.user!.tenantId, id);
  }

  @Post()
  @RequirePermissions('customers.manage')
  create(@Req() req: Request, @Body() body: CreateCustomerDto) {
    return this.customers.create(req.user!.tenantId, body);
  }

  @Patch(':id')
  @RequirePermissions('customers.manage')
  patch(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: PatchCustomerDto,
  ) {
    return this.customers.patch(req.user!.tenantId, id, body, req.user!.userId);
  }

  @Post(':id/notes')
  @RequirePermissions('customers.manage')
  addNote(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AddCustomerNoteDto,
  ) {
    return this.customers.addNote(
      req.user!.tenantId,
      id,
      {
        body: body.body,
        category: body.category,
        branchId: body.branchId,
      },
      req.user!.userId,
    );
  }

  @Post(':id/offers')
  @RequirePermissions('customers.manage')
  offer(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AddOfferDto,
  ) {
    return this.customers.addOffer(req.user!.tenantId, id, body);
  }
}
