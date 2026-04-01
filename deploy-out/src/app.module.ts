import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage } from 'http';
import { StaffAuthCacheModule } from './common/auth-cache/staff-auth-cache.module';
import { OperationalHealthModule } from './common/health/operational-health.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { LeaderLockModule } from './common/leader-lock/leader-lock.module';
import { CommerceModule } from './commerce/commerce.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InvitesModule } from './modules/invites/invites.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PublicModule } from './modules/public/public.module';
import { AiInsightsModule } from './modules/ai-insights/ai-insights.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StaffPushModule } from './modules/staff-push/staff-push.module';
import { SupportModule } from './modules/support/support.module';
import { TablesModule } from './modules/tables/tables.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { BranchGuard } from './common/guards/branch.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { GlobalExceptionFilter } from './common/http/http-exception.filter';
import { redactSensitiveRequestUrl } from './common/http/redact-sensitive-url';
import { assignRequestId } from './common/http/request-id';
import { HttpMetricsInterceptor } from './common/metrics/http-metrics.interceptor';
import { MetricsController } from './common/metrics/metrics.controller';
import { SlowRequestInterceptor } from './common/observability/slow-request.interceptor';
import { validateEnv } from './config/env';

const configuredDbProvider =
  process.env.DB_PROVIDER?.trim().toLowerCase() === 'mysql'
    ? 'mysql'
    : 'postgresql';

const envFilePaths = (
  configuredDbProvider === 'mysql'
    ? [
        resolve(process.cwd(), '.env.mysql-xampp'),
        resolve(process.cwd(), 'apps/api/.env.mysql-xampp'),
        resolve(process.cwd(), '../../.env.mysql-xampp'),
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), 'apps/api/.env'),
        resolve(process.cwd(), '../../.env'),
      ]
    : [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), 'apps/api/.env'),
        resolve(process.cwd(), '../../.env'),
      ]
).filter(
  (filePath, index, arr) =>
    arr.indexOf(filePath) === index && existsSync(filePath),
);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: envFilePaths,
      validate: validateEnv,
    }),
    OperationalHealthModule,
    StaffAuthCacheModule,
    IdempotencyModule,
    LeaderLockModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level:
              config.get<string>('LOG_LEVEL') ?? (isProd ? 'info' : 'debug'),
            transport: !isProd
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
            genReqId: (req, res) =>
              assignRequestId(
                req as IncomingMessage & { requestId?: string },
                res,
              ),
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-support-api-key"]',
              'req.headers["idempotency-key"]',
              'req.headers.idempotency-key',
            ],
            serializers: {
              req: (req: {
                id?: string;
                method?: string;
                url?: string;
                headers?: IncomingMessage['headers'];
              }) => ({
                id: req.id,
                method: req.method,
                url:
                  typeof req.url === 'string'
                    ? redactSensitiveRequestUrl(req.url)
                    : req.url,
              }),
            },
            autoLogging: {
              ignore: (req) => {
                const url =
                  (req as IncomingMessage & { url?: string }).url ?? '';
                return (
                  url.includes('/health/live') ||
                  url.includes('/internal/metrics')
                );
              },
            },
            customProps: (req: IncomingMessage) => {
              const r = req as IncomingMessage & {
                requestId?: string;
                user?: { tenantId?: string; userId?: string };
                branchId?: string;
                headers: IncomingMessage['headers'];
              };
              const headerBranch =
                typeof r.headers['x-branch-id'] === 'string'
                  ? r.headers['x-branch-id']
                  : undefined;
              return {
                requestId: r.requestId,
                tenantId: r.user?.tenantId,
                userId: r.user?.userId,
                branchId: r.branchId ?? headerBranch,
              };
            },
          },
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    CommerceModule,
    AuditModule,
    AuthModule,
    InvitesModule,
    BranchesModule,
    MenuModule,
    TablesModule,
    OrdersModule,
    KitchenModule,
    ReportsModule,
    AiInsightsModule,
    InventoryModule,
    CustomersModule,
    PublicModule,
    StaffPushModule,
    SupportModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    PermissionsGuard,
    BranchGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SlowRequestInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class AppModule {}
