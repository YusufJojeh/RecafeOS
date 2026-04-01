import fs from 'node:fs';
import process from 'node:process';

if (typeof process.loadEnvFile === 'function') {
  if (fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  if (fs.existsSync('apps/api/.env')) {
    process.loadEnvFile('apps/api/.env');
  }
}

const redisUrl = process.env.REDIS_URL;

if (!redisUrl?.trim()) {
  process.stderr.write(
    'REDIS_URL is not set. Integration and smoke verification require a reachable Redis instance.\n',
  );
  process.exit(1);
}

const { createClient } = await import('redis');

const client = createClient({
  url: redisUrl,
  socket: {
    connectTimeout: 3_000,
  },
});

client.on('error', () => {});

try {
  await client.connect();
  await client.ping();
  process.stdout.write('Redis connectivity check passed.\n');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write('Redis connectivity check failed.\n');
  process.stderr.write(`${message}\n`);
  process.stderr.write(
    'Fix REDIS_URL or start the local Redis service before running integration tests or e2e smoke.\n',
  );
  process.exit(1);
} finally {
  if (client.isOpen) {
    await client.quit().catch(() => undefined);
  }
}
