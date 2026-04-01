import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CallWaiterDto } from './dto/call-waiter.dto';
import { PublicCreateOrderDto } from './dto/public-create-order.dto';
import { PublicGuestOrderService } from './public-guest-order.service';
import {
  PublicOrderIdPipe,
  PublicSessionTokenPipe,
  PublicSlugPipe,
} from './pipes/public-route-params.pipe';
import { PublicService } from './public.service';

@ApiTags('public')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('public')
export class PublicController {
  constructor(
    private readonly pub: PublicService,
    private readonly guestOrder: PublicGuestOrderService,
  ) {}

  @Get('tenants/:tenantSlug/branches/:branchSlug/menu')
  @ApiOkResponse({ description: 'Branch menu (no session).' })
  @ApiNotFoundResponse({ description: 'Unknown tenant, branch, or commerce block.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limited.' })
  menu(
    @Param('tenantSlug', PublicSlugPipe) tenantSlug: string,
    @Param('branchSlug', PublicSlugPipe) branchSlug: string,
  ) {
    return this.pub.menuBySlug(tenantSlug, branchSlug);
  }

  @Get('tenants/:tenantSlug/branches/:branchSlug/sessions/:token/menu')
  @ApiOkResponse({ description: 'Menu for an open table session.' })
  @ApiNotFoundResponse({ description: 'Invalid or closed session, or slug mismatch.' })
  @ApiTooManyRequestsResponse()
  sessionMenu(
    @Param('tenantSlug', PublicSlugPipe) tenantSlug: string,
    @Param('branchSlug', PublicSlugPipe) branchSlug: string,
    @Param('token', PublicSessionTokenPipe) token: string,
  ) {
    return this.pub.menuForSession(tenantSlug, branchSlug, token);
  }

  @Post('sessions/:token/call-waiter')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Waiter call recorded.' })
  @ApiBadRequestResponse({ description: 'Feature disabled or invalid body.' })
  @ApiNotFoundResponse({ description: 'Invalid or closed session.' })
  @ApiTooManyRequestsResponse()
  call(
    @Param('token', PublicSessionTokenPipe) token: string,
    @Body() body: CallWaiterDto,
  ) {
    return this.pub.callWaiter(token, body);
  }

  /** Stricter than menu/call-waiter: self-order spam protection. */
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Post('tenants/:tenantSlug/branches/:branchSlug/sessions/:token/order')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Order created or idempotent replay.' })
  @ApiBadRequestResponse({
    description: 'Validation, empty cart, invalid items/modifiers, or missing Idempotency-Key when required.',
  })
  @ApiForbiddenResponse({ description: 'QR ordering disabled for branch.' })
  @ApiNotFoundResponse({ description: 'Invalid or closed session, or slug mismatch.' })
  @ApiTooManyRequestsResponse()
  @ApiServiceUnavailableResponse({
    description: 'Idempotency lock contention; retry with same key.',
  })
  createGuestOrder(
    @Param('tenantSlug', PublicSlugPipe) tenantSlug: string,
    @Param('branchSlug', PublicSlugPipe) branchSlug: string,
    @Param('token', PublicSessionTokenPipe) token: string,
    @Body() body: PublicCreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.guestOrder.createOrderFromSession(
      tenantSlug,
      branchSlug,
      token,
      body,
      idempotencyKey,
    );
  }

  @Get('tenants/:tenantSlug/branches/:branchSlug/sessions/:token/orders/:orderId')
  @ApiOkResponse({ description: 'Order status for this session.' })
  @ApiNotFoundResponse({ description: 'Session or order not found for this context.' })
  @ApiTooManyRequestsResponse()
  guestOrderStatus(
    @Param('tenantSlug', PublicSlugPipe) tenantSlug: string,
    @Param('branchSlug', PublicSlugPipe) branchSlug: string,
    @Param('token', PublicSessionTokenPipe) token: string,
    @Param('orderId', PublicOrderIdPipe) orderId: string,
  ) {
    return this.guestOrder.getOrderStatusForSession(
      tenantSlug,
      branchSlug,
      token,
      orderId,
    );
  }
}
