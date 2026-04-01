import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { Server } from 'socket.io';
import { RedisIoAdapter } from './redis-io.adapter';

jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(),
}));

describe('RedisIoAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('connects pub/sub clients and stores adapter factory', async () => {
    const subClient = {
      connect: jest.fn().mockResolvedValue(undefined),
    };
    const pubClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      duplicate: jest.fn().mockReturnValue(subClient),
    };
    const adapterFactory = jest.fn();

    (createClient as jest.Mock).mockReturnValue(pubClient);
    (createAdapter as jest.Mock).mockReturnValue(adapterFactory);

    const adapter = new RedisIoAdapter({} as never, 'redis://localhost:6379');

    await adapter.connectToRedis();

    expect(createClient).toHaveBeenCalledWith({
      url: 'redis://localhost:6379',
    });
    expect(pubClient.duplicate).toHaveBeenCalledTimes(1);
    expect(pubClient.connect).toHaveBeenCalledTimes(1);
    expect(subClient.connect).toHaveBeenCalledTimes(1);
    expect(createAdapter).toHaveBeenCalledWith(pubClient, subClient);
  });

  it('attaches redis adapter to created socket server after redis setup', async () => {
    const adapterSpy = jest.fn();
    const fakeServer = {
      adapter: adapterSpy,
    } as unknown as Server;
    const adapterFactory = jest.fn();
    const pubClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      duplicate: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
      }),
    };

    (createClient as jest.Mock).mockReturnValue(pubClient);
    (createAdapter as jest.Mock).mockReturnValue(adapterFactory);
    jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue(fakeServer);

    const adapter = new RedisIoAdapter({} as never, 'redis://localhost:6379');
    await adapter.connectToRedis();

    const server = adapter.createIOServer(3001, { path: '/ws' });

    expect(server).toBe(fakeServer);
    expect(adapterSpy).toHaveBeenCalledWith(adapterFactory);
  });

  it('creates a socket server without redis adapter when connectToRedis was not called', () => {
    const adapterSpy = jest.fn();
    const fakeServer = {
      adapter: adapterSpy,
    } as unknown as Server;

    jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue(fakeServer);

    const adapter = new RedisIoAdapter({} as never, 'redis://localhost:6379');
    const server = adapter.createIOServer(3001);

    expect(server).toBe(fakeServer);
    expect(adapterSpy).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});
