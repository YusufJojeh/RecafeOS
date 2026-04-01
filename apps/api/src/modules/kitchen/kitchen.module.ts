import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { WebsocketModule } from '../../websocket/websocket.module';
import { BarController, KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';

@Module({
  imports: [WebsocketModule, OrdersModule],
  controllers: [KitchenController, BarController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}
