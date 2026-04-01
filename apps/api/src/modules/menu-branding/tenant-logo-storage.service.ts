import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SAFE_WEBP =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

@Injectable()
export class TenantLogoStorageService {
  constructor(private readonly config: ConfigService) {}

  rootDir(): string {
    const raw = this.config.get<string>('UPLOAD_ROOT')?.trim();
    if (raw) return raw;
    return join(process.cwd(), 'data', 'uploads');
  }

  tenantLogoDir(tenantId: string): string {
    return join(this.rootDir(), 'tenant-logos', tenantId);
  }

  isSafeObjectKey(key: string): boolean {
    return SAFE_WEBP.test(key);
  }

  resolveAbsolutePath(tenantId: string, key: string): string {
    return join(this.tenantLogoDir(tenantId), key);
  }

  async saveProcessedWebp(tenantId: string, buffer: Buffer): Promise<string> {
    const name = `${randomUUID()}.webp`;
    const dir = this.tenantLogoDir(tenantId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), buffer);
    return name;
  }

  async removeIfExists(tenantId: string, key: string | null | undefined): Promise<void> {
    if (!key || !this.isSafeObjectKey(key)) return;
    try {
      await unlink(this.resolveAbsolutePath(tenantId, key));
    } catch {
      /* ignore missing */
    }
  }
}
