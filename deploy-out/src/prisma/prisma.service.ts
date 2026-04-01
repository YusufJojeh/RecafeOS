import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  inferDatabaseProviderFromUrl,
  isMysqlLocalMode,
  resolveConfiguredDatabaseProvider,
  type SupportedDatabaseProvider,
} from './database-provider';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly databaseProvider = resolveConfiguredDatabaseProvider();

  async onModuleInit(): Promise<void> {
    this.validateDatabaseUrl();
    this.warnIfPoolNotConfigured();
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Emits a startup warning when DATABASE_URL does not contain an explicit
   * connection_limit param. In production this is almost always a mistake —
   * Prisma defaults to `num_cpus × 2 + 1`, which can exhaust Postgres
   * max_connections when running multiple API replicas.
   */
  private warnIfPoolNotConfigured(): void {
    if (this.databaseProvider !== 'postgresql') {
      return;
    }
    const url = process.env.DATABASE_URL ?? '';
    if (!url.includes('connection_limit')) {
      this.logger.warn(
        'DATABASE_URL has no explicit connection_limit. ' +
          'Prisma will use its internal default pool size. ' +
          'For production, add ?connection_limit=15&pool_timeout=10 ' +
          'and ensure (limit × replicas) < 70% of Postgres max_connections. ' +
          'See docs/operations/capacity-analysis.md §4.1.',
      );
    }
  }

  private validateDatabaseUrl(): void {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      return;
    }

    const urlProvider = inferDatabaseProviderFromUrl(url);
    if (urlProvider === 'unknown') {
      throw new Error(
        'Unsupported DATABASE_URL protocol. Supported providers are postgresql and mysql.',
      );
    }

    if (
      (urlProvider === 'postgresql' || urlProvider === 'mysql') &&
      urlProvider !== this.databaseProvider
    ) {
      throw new Error(
        `DB_PROVIDER=${this.databaseProvider} does not match DATABASE_URL provider ${urlProvider}.`,
      );
    }

    if (this.databaseProvider === 'postgresql') {
      return;
    }

    if (!isMysqlLocalMode()) {
      throw new Error(
        'MySQL is only supported for local development. Set DB_PROVIDER=mysql and ALLOW_MYSQL_LOCAL=true, and do not use this in production. ' +
          'See docs/database/COMPATIBILITY.md for the exact limits.',
      );
    }
  }

  getDatabaseProvider(): SupportedDatabaseProvider {
    return this.databaseProvider;
  }

  isMysqlLocalMode(): boolean {
    return this.databaseProvider === 'mysql';
  }
}
