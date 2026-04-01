import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  SUPPORT_ACCESS_METADATA_KEY,
  type SupportAccessMode,
} from './support-access.decorator';
import { SupportKeyService } from './support-key.service';

const HEADER = 'x-support-api-key';

@Injectable()
export class SupportApiKeyGuard implements CanActivate {
  constructor(
    private readonly keys: SupportKeyService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.keys.isDisabled()) {
      throw new ForbiddenException('Support API is not configured');
    }
    const accessMode = this.reflector.getAllAndOverride<SupportAccessMode>(
      SUPPORT_ACCESS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!accessMode) {
      throw new InternalServerErrorException(
        'Support route missing @SupportAccess metadata',
      );
    }
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers[HEADER];
    if (typeof key !== 'string') {
      throw new ForbiddenException();
    }
    const ok =
      accessMode === 'read'
        ? this.keys.checkRead(key)
        : this.keys.checkWrite(key);
    if (!ok) {
      throw new ForbiddenException();
    }
    return true;
  }
}
