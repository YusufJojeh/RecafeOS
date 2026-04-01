import net from 'node:net';

const services = [
  { name: 'postgres', host: '127.0.0.1', port: 5432 },
  { name: 'redis', host: '127.0.0.1', port: 6379 },
  { name: 'minio', host: '127.0.0.1', port: 9000 },
];

const timeoutMs = 60_000;
const retryDelayMs = 1_000;

function wait(delay) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2_000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function waitForService(service) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnect(service.host, service.port)) {
      process.stdout.write(`ready: ${service.name} on ${service.host}:${service.port}\n`);
      return;
    }
    await wait(retryDelayMs);
  }
  throw new Error(
    `Timed out after ${timeoutMs / 1000}s waiting for ${service.name} on ${service.host}:${service.port}.`,
  );
}

for (const service of services) {
  await waitForService(service);
}
