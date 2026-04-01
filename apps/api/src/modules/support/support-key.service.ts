import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

function trimKey(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

@Injectable()
export class SupportKeyService implements OnModuleInit {
  private readonly logger = new Logger(SupportKeyService.name);
  private mode: 'disabled' | 'legacy' | 'split' = 'disabled';
  private legacyKey?: string;
  private readKey?: string;
  private writeKey?: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const legacy = trimKey(this.config.get<string>('SUPPORT_API_KEY'));
    const read = trimKey(this.config.get<string>('SUPPORT_API_KEY_READ'));
    const write = trimKey(this.config.get<string>('SUPPORT_API_KEY_WRITE'));

    const hasSplit = !!(read || write);
    if (hasSplit && (!read || !write)) {
      throw new Error(
        'SUPPORT_API_KEY_READ and SUPPORT_API_KEY_WRITE must both be set when using split keys.',
      );
    }
    if (legacy && hasSplit) {
      throw new Error(
        'Use either SUPPORT_API_KEY alone or SUPPORT_API_KEY_READ and SUPPORT_API_KEY_WRITE together, not both.',
      );
    }
    if (!legacy && !hasSplit) {
      this.mode = 'disabled';
      this.logger.warn(
        'Support API not configured (set SUPPORT_API_KEY or SUPPORT_API_KEY_READ and SUPPORT_API_KEY_WRITE)',
      );
      return;
    }

    if (hasSplit) {
      this.mode = 'split';
      this.readKey = read;
      this.writeKey = write;
      this.logger.log('Support API key mode: split (read/write)');
    } else {
      this.mode = 'legacy';
      this.legacyKey = legacy;
      this.logger.log('Support API key mode: legacy (single key)');
    }
  }

  isSplitMode(): boolean {
    return this.mode === 'split';
  }

  isDisabled(): boolean {
    return this.mode === 'disabled';
  }

  /** Legacy key authorizes all routes; read key or write key for GET; write key only for mutations in split mode. */
  checkRead(key: string | undefined): boolean {
    if (this.mode === 'disabled') {
      return false;
    }
    if (typeof key !== 'string' || !key) {
      return false;
    }
    if (this.mode === 'legacy') {
      return timingSafeStringEqual(key, this.legacyKey!);
    }
    return (
      timingSafeStringEqual(key, this.readKey!) ||
      timingSafeStringEqual(key, this.writeKey!)
    );
  }

  checkWrite(key: string | undefined): boolean {
    if (this.mode === 'disabled') {
      return false;
    }
    if (typeof key !== 'string' || !key) {
      return false;
    }
    if (this.mode === 'legacy') {
      return timingSafeStringEqual(key, this.legacyKey!);
    }
    return timingSafeStringEqual(key, this.writeKey!);
  }
}
