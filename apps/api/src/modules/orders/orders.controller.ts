import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderBillingService } from './order-billing.service';
import { OrderCreationService } from './order-creation.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrderLinesService } from './order-lines.service';
import { OrderPrepService } from './order-prep.service';
import { OrderReadService } from './order-read.service';
import { OrderTableService } from './order-table.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CloseBillDto } from './dto/close-bill.dto';
import { DiscountDto } from './dto/discount.dto';
import { MergeOrdersDto } from './dto/merge-orders.dto';
import { MoveTableDto } from './dto/move-table.dto';
import { OrderItemQtyDto } from './dto/order-item-qty.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { OpenOrdersQueryDto } from './dto/open-orders.query';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchGuard, PermissionsGuard)
@Controller('branches/:branchId/orders')
export class OrdersController {
  constructor(
    private readonly read: OrderReadService,
    private readonly creation: OrderCreationService,
    private readonly lines: OrderLinesService,
    private readonly prep: OrderPrepService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly table: OrderTableService,
    private readonly billing: OrderBillingService,
  ) {}

  @Get()
  @RequirePermissions('orders.edit')
  list(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Query() query: OpenOrdersQueryDto,
  ) {
    return this.read.listOpen(branchId, req.user!.tenantId, query);
  }

  @Get(':orderId')
  @RequirePermissions('orders.edit')
  getOne(
    @Param('branchId') branchId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
  ) {
    return this.read.getOne(branchId, req.user!.tenantId, orderId);
  }

  @Post()
  @HttpCode(200)
  @RequirePermissions('orders.create')
  create(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.creation.createOrder(
      branchId,
      req.user!.tenantId,
      body,
      idempotencyKey,
    );
  }

  @Post(':orderId/items')
  @HttpCode(200)
  @RequirePermissions('orders.edit')
  addItem(
    @Param('branchId') branchId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
    @Body() body: AddOrderItemDto,
  ) {
    return this.lines.addItem(branchId, req.user!.tenantId, orderId, body);
  }

  @Post(':orderId/items/:itemId/qty')
  @HttpCode(200)
  @RequirePermissions('orders.edit')
  qty(
    @Param('branchId') branchId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @Body() body: OrderItemQtyDto,
  ) {
    return this.lines.updateItemQty(
      branchId,
      req.user!.tenantId,
      orderId,
      itemId,
      body,
    );
  }

  @Post(':orderId/confirm')
  @HttpCode(200)
  @RequirePermissions('orders.edit')
  confirm(
    @Param('branchId') branchId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
  ) {
    return this.lifecycle.confirm(
      branchId,
      req.user!.tenantId,
      req.user!.userId,
      orderId,
    );
  }

  @Post(':orderId/send-to-preparation')
  @HttpCode(200)
  @RequirePermissions('orders.edit')
  send(
    @Param('branchId') branchId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
  ) {
    return this.prep.sendToPreparation(branchId, req.user!.tenantId, orderId);
  }

  @Post(':orderId/discount')
  @HttpCode(200)
  @RequirePermissions('orders.discount')
  discount(
    @Param('branchId') branchId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
    @Body() body: DiscountDto,
  ) {
    return this.lifecycle.applyDiscount(
      branchId,
      req.user!.tenantId,
      req.user!.userId,
      orderId,
      body,
    );
  }

  @Post(':orderId/move-table')
  @HttpCode(200)
  @RequirePermissions('orders.edit')
  move(
    @Param('branchId') branchId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
    @Body() body: MoveTableDto,
  ) {
    return this.table.moveToTable(
      branchId,
      req.user!.tenantId,
      orderId,
      body.tableSessionId,
    );
  }

  @Post('merge')
  @HttpCode(200)
  @RequirePermissions('orders.edit')
  merge(
    @Param('branchId') branchId: string,
    @Req() req: Request,
    @Body() body: MergeOrdersDto,
  ) {
    return this.table.mergeOrders(
      branchId,
      req.user!.tenantId,
      body.targetOrderId,
      body.sourceOrderId,
    );
  }

  @Post(':orderId/served')
  @HttpCode(200)
  @RequirePermissions('orders.edit')
  served(
    @Param('branchId') branchId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
  ) {
    return this.lifecycle.markServed(
      branchId,
      req.user!.tenantId,
      req.user!.userId,
      orderId,
    );
  }

  @Post(':orderId/close')
  @HttpCode(200)
  @RequirePermissions('payments.close')
  close(
    @Param('branchId') branchId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CloseBillDto,
  ) {
    return this.billing.closeBill(
      branchId,
      req.user!.tenantId,
      req.user!.userId,
      orderId,
      body,
      idempotencyKey,
    );
  }

  @Post(':orderId/cancel')
  @HttpCode(200)
  @RequirePermissions('orders.cancel')
  cancel(
    @Param('branchId') branchId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
    @Body() body?: CancelOrderDto,
  ) {
    return this.lifecycle.cancel(
      branchId,
      req.user!.tenantId,
      req.user!.userId,
      orderId,
      body,
    );
  }
}
