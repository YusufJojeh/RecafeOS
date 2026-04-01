import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { routePermissions } from '../src/common/security/permissions.map';
import { PrismaService } from '../src/prisma/prisma.service';

const GLOBAL_PREFIX = 'api/v1';

/** Liveness/readiness — not part of RBAC matrix. */
const SWAGGER_ROUTES_EXCLUDED_FROM_MAP = new Set([
  'GET /health',
  'GET /health/live',
  'GET /health/ready',
]);

function normalizePathTemplate(swaggerPath: string): string {
  let p = swaggerPath.startsWith('/') ? swaggerPath : `/${swaggerPath}`;
  const prefix = `/${GLOBAL_PREFIX}`;
  if (p === prefix || p.startsWith(`${prefix}/`)) {
    p = p.slice(prefix.length) || '/';
  }
  if (!p.startsWith('/')) {
    p = `/${p}`;
  }
  return p.replace(/\{([^}]+)\}/g, ':$1');
}

function collectSwaggerRouteKeys(doc: { paths?: Record<string, unknown> }): Set<string> {
  const keys = new Set<string>();
  const paths = doc.paths ?? {};
  for (const rawPath of Object.keys(paths)) {
    const pathItem = paths[rawPath] as Record<string, unknown> | undefined;
    if (!pathItem) continue;
    const templ = normalizePathTemplate(rawPath);
    for (const method of [
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'options',
      'head',
    ] as const) {
      if (pathItem[method]) {
        keys.add(`${method.toUpperCase()} ${templ}`);
      }
    }
  }
  return keys;
}

async function main(): Promise<void> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      $connect: async () => undefined,
      $disconnect: async () => undefined,
      onModuleInit: async () => undefined,
      onModuleDestroy: async () => undefined,
    })
    .compile();

  const app = moduleRef.createNestApplication();
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('RestoCafe OS').setVersion('0').build(),
  );
  await app.close();

  const swaggerKeys = collectSwaggerRouteKeys(doc);
  const mapKeys = new Set(Object.keys(routePermissions) as string[]);

  const inSwaggerNotMap = [...swaggerKeys].filter(
    (k) => !mapKeys.has(k) && !SWAGGER_ROUTES_EXCLUDED_FROM_MAP.has(k),
  );
  const inMapNotSwagger = [...mapKeys].filter((k) => !swaggerKeys.has(k));

  if (inSwaggerNotMap.length > 0 || inMapNotSwagger.length > 0) {
    console.error('routePermissions drift vs Swagger:\n');
    if (inSwaggerNotMap.length > 0) {
      console.error(
        'Documented in Swagger but missing from routePermissions (add entry or allowlist):\n',
        inSwaggerNotMap.sort().join('\n'),
        '\n',
      );
    }
    if (inMapNotSwagger.length > 0) {
      console.error(
        'Listed in routePermissions but not in Swagger (typo, wrong path, or @ApiExcludeController):\n',
        inMapNotSwagger.sort().join('\n'),
        '\n',
      );
    }
    process.exit(1);
  }
  console.log('OK: routePermissions matches Swagger HTTP routes.');
}

void main().catch((error: unknown) => {
  console.error('verify-route-permissions failed before route comparison.');
  console.error(error);
  process.exit(1);
});
