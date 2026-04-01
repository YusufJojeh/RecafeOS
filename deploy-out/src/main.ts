import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { resolveCorsOrigin } from './common/http/cors-origins';
import { RedisIoAdapter } from './websocket/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const redisUrl = config.get<string>('REDIS_URL')?.trim();
  if (redisUrl) {
    const wsAdapter = new RedisIoAdapter(app, redisUrl);
    await wsAdapter.connectToRedis();
    app.useWebSocketAdapter(wsAdapter);
  }
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);
  const idempotencyRedisRequired =
    config.get<string>('IDEMPOTENCY_REQUIRE_REDIS') === 'true';

  if (idempotencyRedisRequired) {
    logger.log(
      'Redis-backed idempotency is required in this environment.',
      'Bootstrap',
    );
  }

  if (config.get<string>('TRUST_PROXY') === 'true') {
    app.set('trust proxy', 1);
  }

  if (config.get<string>('HELMET_ENABLED') !== 'false') {
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );
  }

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
  });

  if (
    config.get<string>('NODE_ENV') !== 'production' ||
    config.get<string>('SWAGGER_ENABLED') === 'true'
  ) {
    const config = new DocumentBuilder()
      .setTitle('RestoCafe OS API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(config.get<number>('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');

  const isProd = config.get<string>('NODE_ENV') === 'production';
  const metricsOn = config.get<string>('METRICS_ENABLED') === 'true';

  if (isProd && !metricsOn) {
    logger.warn(
      'METRICS_ENABLED is not set to "true". ' +
        'Prometheus metrics endpoint (/api/v1/internal/metrics) is disabled. ' +
        'Set METRICS_ENABLED=true for production observability.',
      'Bootstrap',
    );
  }
}
void bootstrap();
