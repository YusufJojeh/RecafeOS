import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { ServerOptions } from 'socket.io';
import type { Server } from 'socket.io';

/**
 * Shares Socket.IO room state across API replicas via Redis pub/sub.
 * Call {@link RedisIoAdapter.connectToRedis} before `app.listen`.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterFactory: ReturnType<typeof createAdapter> | undefined;

  constructor(
    app: INestApplication,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({ url: this.redisUrl });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterFactory = createAdapter(pubClient, subClient);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterFactory) {
      server.adapter(this.adapterFactory);
    }
    return server;
  }
}
