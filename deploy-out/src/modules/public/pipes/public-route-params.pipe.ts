import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

/** Prisma `cuid()` for `TableSession.publicToken` — allow URL-safe charset + length bounds. */
const TOKEN_RE = /^[a-zA-Z0-9_-]{8,64}$/;

/** URL slugs for tenant/branch paths (lowercase, hyphenated, max 64 chars). */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function assertMatches(
  value: unknown,
  re: RegExp,
  label: string,
): asserts value is string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`Invalid ${label}`);
  }
  const v = value.trim();
  if (!re.test(v)) {
    throw new BadRequestException(`Invalid ${label}`);
  }
}

@Injectable()
export class PublicSessionTokenPipe implements PipeTransform<string, string> {
  transform(value: string, _meta?: ArgumentMetadata): string {
    assertMatches(value, TOKEN_RE, 'session token');
    return value.trim();
  }
}

@Injectable()
export class PublicSlugPipe implements PipeTransform<string, string> {
  transform(value: string, _meta?: ArgumentMetadata): string {
    assertMatches(value, SLUG_RE, 'path segment');
    return value.trim();
  }
}

@Injectable()
export class PublicOrderIdPipe implements PipeTransform<string, string> {
  transform(value: string, _meta?: ArgumentMetadata): string {
    assertMatches(value, TOKEN_RE, 'order id');
    return value.trim();
  }
}
