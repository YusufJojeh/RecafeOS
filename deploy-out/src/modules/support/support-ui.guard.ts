import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupportUiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: { email?: string };
    }>();
    const email = req.user?.email?.trim().toLowerCase();
    if (!email) {
      throw new ForbiddenException();
    }

    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    const enabledRaw = this.config.get<string>('SUPPORT_UI_ENABLED');
    const enabled =
      enabledRaw === 'true' || (enabledRaw == null && nodeEnv !== 'production');
    if (!enabled) {
      throw new NotFoundException();
    }

    const allowlist = (
      this.config.get<string>('SUPPORT_UI_ALLOWED_EMAILS') ?? ''
    )
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (allowlist.length === 0) {
      if (nodeEnv === 'production') {
        throw new ForbiddenException(
          'Support UI is enabled but SUPPORT_UI_ALLOWED_EMAILS is empty.',
        );
      }
      return true;
    }

    if (!allowlist.includes(email)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
