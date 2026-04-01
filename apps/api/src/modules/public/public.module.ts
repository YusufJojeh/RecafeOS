import { Module } from '@nestjs/common';
import { CommerceModule } from '../../commerce/commerce.module';
import { WebsocketModule } from '../../websocket/websocket.module';
import { MenuBrandingModule } from '../menu-branding/menu-branding.module';
import { OrdersModule } from '../orders/orders.module';
import { PublicController } from './public.controller';
import { PublicGuestOrderService } from './public-guest-order.service';
import {
  PublicOrderIdPipe,
  PublicSessionTokenPipe,
  PublicSlugPipe,
} from './pipes/public-route-params.pipe';
import { PublicService } from './public.service';

@Module({
  imports: [WebsocketModule, CommerceModule, OrdersModule, MenuBrandingModule],
  controllers: [PublicController],
  providers: [
    PublicService,
    PublicGuestOrderService,
    PublicSessionTokenPipe,
    PublicSlugPipe,
    PublicOrderIdPipe,
  ],
})
export class PublicModule {}
