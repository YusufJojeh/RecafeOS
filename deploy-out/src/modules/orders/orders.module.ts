import { Module } from '@nestjs/common';
import { CommerceModule } from '../../commerce/commerce.module';
import { WebsocketModule } from '../../websocket/websocket.module';
import { OrderBillingService } from './order-billing.service';
import { OrderCreationService } from './order-creation.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrderLinesService } from './order-lines.service';
import { OrderPrepService } from './order-prep.service';
import { OrderReadService } from './order-read.service';
import { OrderRepository } from './order-repository';
import { OrderStockService } from './order-stock.service';
import { OrderTableService } from './order-table.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [WebsocketModule, CommerceModule],
  controllers: [OrdersController],
  providers: [
    OrderRepository,
    OrderReadService,
    OrderCreationService,
    OrderLinesService,
    OrderPrepService,
    OrderLifecycleService,
    OrderTableService,
    OrderStockService,
    OrderBillingService,
  ],
  exports: [
    OrderLifecycleService,
    OrderCreationService,
    OrderLinesService,
    OrderPrepService,
  ],
})
export class OrdersModule {}
