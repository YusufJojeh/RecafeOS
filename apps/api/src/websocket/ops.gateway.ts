import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { BranchRealtimePayloads } from '@restocafe/types';
import {
  STAFF_WS,
  type StaffWsJoinBranchPayload,
  staffWsBranchRoom,
} from '@restocafe/types';
import type { JwtAccessPayload } from '../common/types/jwt-payload';
import { StaffAuthCacheService } from '../common/auth-cache/staff-auth-cache.service';
import { whereBranchInTenant } from '../common/persistence/branch-scope';
import { PrismaService } from '../prisma/prisma.service';
import { resolveCorsOrigin } from '../common/http/cors-origins';
import {
  incWsBranchEmit,
  wsConnectionDelta,
} from '../common/metrics/prometheus';
import { BranchRealtimePushBridgeService } from '../modules/staff-push/branch-realtime-push-bridge.service';
import { tokenFromSocket } from './socket-token';

const WS_USER = 'wsUser' as const;

@WebSocketGateway({
  namespace: STAFF_WS.NAMESPACE,
  cors: { origin: resolveCorsOrigin(), credentials: true },
  pingInterval: 25_000,
  pingTimeout: 10_000,
  maxHttpBufferSize: 64 * 1024,
  connectTimeout: 15_000,
})
export class OpsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OpsGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authCache: StaffAuthCacheService,
    private readonly branchPushBridge: BranchRealtimePushBridgeService,
  ) {}

  async handleConnection(client: Socket) {
    const token = tokenFromSocket(client);
    if (!token) {
      this.logger.warn(`WS ${client.id}: no token`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtAccessPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.type !== 'access') {
        throw new Error('invalid_token_type');
      }
      (client.data as Record<string, unknown>)[WS_USER] = payload;
      wsConnectionDelta(1);
      this.logger.log(
        JSON.stringify({
          msg: 'ws_connected',
          socketId: client.id,
          tenantId: payload.tenantId,
        }),
      );
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client.data as Record<string, JwtAccessPayload | undefined>)[
      WS_USER
    ];
    if (user) {
      wsConnectionDelta(-1);
      this.logger.log(
        JSON.stringify({
          msg: 'ws_disconnected',
          socketId: client.id,
          tenantId: user.tenantId,
        }),
      );
    }
  }

  @SubscribeMessage(STAFF_WS.CLIENT_EVENT_JOIN_BRANCH)
  async joinBranch(
    client: Socket,
    payload: Partial<StaffWsJoinBranchPayload> | undefined,
  ) {
    const user = (client.data as Record<string, JwtAccessPayload | undefined>)[
      WS_USER
    ];
    if (!user) {
      return { ok: false, error: 'unauthorized' };
    }
    const branchId = payload?.branchId;
    if (typeof branchId !== 'string' || !branchId.length) {
      return { ok: false, error: 'branch_required' };
    }
    const cached = await this.authCache.getBranchInTenant(
      user.tenantId,
      branchId,
    );
    if (cached === false) {
      return { ok: false, error: 'forbidden' };
    }
    if (cached === null) {
      const branch = await this.prisma.branch.findFirst({
        where: whereBranchInTenant(branchId, user.tenantId),
        select: { id: true },
      });
      const ok = branch != null;
      await this.authCache.setBranchInTenant(user.tenantId, branchId, ok);
      if (!ok) {
        return { ok: false, error: 'forbidden' };
      }
    }
    await client.join(staffWsBranchRoom(branchId));
    return { ok: true };
  }

  emitBranchEvent<K extends keyof BranchRealtimePayloads>(
    branchId: string,
    event: K,
    payload: BranchRealtimePayloads[K],
  ): void {
    incWsBranchEmit(String(event));
    this.server.to(staffWsBranchRoom(branchId)).emit(event, payload);
    void this.branchPushBridge
      .relayFromRealtime(branchId, event, payload)
      .catch((err: unknown) => {
        this.logger.warn(
          JSON.stringify({
            msg: 'branch_push_bridge_failed',
            branchId,
            event: String(event),
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      });
  }
}
