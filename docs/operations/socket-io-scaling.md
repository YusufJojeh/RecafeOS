# Socket.IO horizontal scaling (multi-instance API)

## Current behavior

- The NestJS [`OpsGateway`](../../apps/api/src/websocket/ops.gateway.ts) broadcasts with `server.to('branch:${id}').emit(...)`.
- **Namespace:** `/ws` (client connects to `{apiOrigin}/ws`; path `/socket.io` is the Engine.IO transport).
- When **`REDIS_URL` is set**, [`main.ts`](../../apps/api/src/main.ts) installs [`RedisIoAdapter`](../../apps/api/src/websocket/redis-io.adapter.ts) using `@socket.io/redis-adapter` and the **`redis`** client so **all API replicas** share room membership via Redis pub/sub.
- When **`REDIS_URL` is unset**, the default in-memory adapter is used — correct for **one** API process only.

## Pilot vs multi-replica (decision table)

| Deployment | `REDIS_URL` for Socket.IO | Notes |
|------------|---------------------------|--------|
| **Single API replica** (no overlapping second instance) | Optional for realtime | Simplest ops; all connects and emits hit the same process. |
| **Two+ API replicas**, rolling deploy with overlap, or canary | **Required** | Without a shared adapter, emits on replica B do not reach sockets attached to replica A. |
| **Already using Redis** for [close-bill idempotency](./idempotency-and-offline.md) | **Use the same Redis** | One cluster for idempotency + Socket.IO adapter. |

**Threshold:** As soon as **more than one API instance can serve traffic at the same time**, enable `REDIS_URL` on **every** API pod. **Sticky sessions alone are not sufficient:** HTTP handlers and `emitBranchEvent` run on whichever replica handled the request; only a **shared adapter** (Redis pub/sub) propagates room broadcasts to all nodes.

**Optional sticky / session affinity:** Not required for correct delivery once the Redis adapter is enabled. Some teams still enable LB affinity to reduce reconnect churn during deploys—it is **not** a substitute for Redis.

## Room naming

- **Pattern:** `branch:${branchId}` (CUID string from Postgres).
- **Meaning:** All staff sockets that successfully **`joinBranch`** for that branch receive branch-scoped events (orders, tickets, waiter calls, etc.).
- **Server-only:** Clients must not construct arbitrary room names; membership is granted only via [`joinBranch`](../../apps/api/src/websocket/ops.gateway.ts) after tenant-scoped branch lookup.

## Connection authentication

- **Token location:** [`tokenFromSocket`](../../apps/api/src/websocket/socket-token.ts) reads, in order:
  1. `handshake.auth.token` (used by [`branch-realtime.tsx`](../../apps/ops-web/src/lib/branch-realtime.tsx) via `io(..., { auth: { token: accessToken } })`).
  2. Else `Authorization: Bearer <jwt>` on the handshake.
- **Verification:** JWT **access** token is verified once in `handleConnection` with `JWT_ACCESS_SECRET`; wrong or missing token ⇒ **immediate disconnect**.
- **`joinBranch`:** After connection, the client emits `joinBranch` with `{ branchId }`. The server checks the branch belongs to the user’s `tenantId` before `client.join('branch:${branchId}')`.

## JWT expiry and long-lived tabs

- The access token is **not** re-verified on each server-pushed event. If the token **expires** while the socket stays open, **HTTP API** calls may return 401 while the WebSocket can still appear connected until the next disconnect.
- **Mitigation in ops-web:** `BranchRealtimeProvider` depends on `accessToken` and `branchId`; when the app refreshes the token or re-logins, the effect re-runs and **recreates** the socket with a new token.
- **Product expectation for pilots:** Staff refresh or navigate if API calls fail; document for support.

## Reconnect behavior

- **Client:** [`branch-realtime.tsx`](../../apps/ops-web/src/lib/branch-realtime.tsx) uses `reconnectionAttempts: 12`, backoff up to 30s, transports `websocket` + `polling`.
- **Server-side rooms:** Membership does **not** survive reconnect. On each **`connect`**, the client sends **`joinBranch`** again (implemented in the `connect` handler).
- **UI:** On `disconnect` / `connect_error`, `BranchRealtimeConnected` is false; pages such as Kitchen may increase HTTP `refetchInterval` when realtime is down.
- **Resync after reconnect:** On Socket.IO automatic **`reconnect`**, ops-web [`branch-realtime.tsx`](../../apps/ops-web/src/lib/branch-realtime.tsx) invalidates branch-scoped query keys once (`tickets`, `open-orders`, `tables`, `ops-snapshot`, `reports`) so data missed during the outage is refetched.

## Event contract

- **Source of truth:** [`packages/types/src/realtime.ts`](../../packages/types/src/realtime.ts) — `BranchRealtimeEvent` names, `BranchRealtimePayloads`, and `REALTIME_CONTRACT_VERSION`.
- **Breaking changes:** Bump `REALTIME_CONTRACT_VERSION` and release API + ops-web together when renaming events or changing payload shapes.

## Failure and degradation

| Situation | Expected behavior |
|-----------|-------------------|
| Transient network | Client reconnects; `joinBranch` restores room membership. |
| API pod restart | Same as reconnect. |
| **`REDIS_URL` set but Redis down** at startup | [`connectToRedis`](../../apps/api/src/websocket/redis-io.adapter.ts) may fail; treat Redis as a **hard dependency** when using multi-replica + adapter—API should not run without it in that configuration. |
| Invalid / expired token at handshake | Socket disconnected; user must re-authenticate. |
| Two replicas **without** Redis | **Not supported** for correct branch realtime; some clients miss emits. Rely on HTTP polling only if at all. |

## Load balancer and WebSocket

- Proxy **`/socket.io/`** with HTTP/1.1, `Upgrade`, and `Connection: upgrade` (see [`deploy/nginx/restocafe.conf.example`](../../deploy/nginx/restocafe.conf.example)).
- With the **Redis adapter**, clients may connect to **any** API instance; broadcasts reach all sockets in the room across nodes.

## Limitation (no Redis, multiple instances)

- With **multiple API instances** and **no** Redis adapter, a client on **instance A** will not receive emits triggered on **instance B**.

## Operations (multi-instance)

1. Run **Redis** reachable from every API pod (see [`deploy/docker-compose.stack.yml`](../../deploy/docker-compose.stack.yml)).
2. Set **`REDIS_URL`** on every API replica (same value).
3. Do **not** rely on sticky sessions instead of Redis for broadcast correctness.

## Operations checklist

- [ ] Redis reachable from every API pod with low latency.
- [ ] Same `JWT_ACCESS_SECRET` and CORS settings on all instances.
- [ ] Monitor Redis memory and connection count under peak concurrent staff devices.
- [ ] Staging verification: [`staging-socket-io-checklist.md`](./staging-socket-io-checklist.md).

## Rollout: second API replica (safe order)

1. Provision Redis (or confirm existing) reachable from **all** API pods.
2. Set **`REDIS_URL`** on the **first** replica; deploy and smoke-test realtime (single browser).
3. Add the **second** replica behind the load balancer; confirm health checks on both.
4. Run the [staging Socket.IO checklist](./staging-socket-io-checklist.md) (two clients, same branch).
5. **Do not** introduce a second live API instance without `REDIS_URL` if branch realtime quality matters.

## Station-scoped rooms (evaluation; not implemented)

Today all staff for a branch share one room `branch:${branchId}` — every subscriber receives every event (kitchen, bar, floor).

**Possible future design:** separate rooms such as `branch:${branchId}:KITCHEN`, `:BAR`, or role-based channels; extend `joinBranch` (or add `joinBranchStation`) and route `emitBranchEvent` to the right room(s).

**Tradeoffs:** More connection/join complexity, possible dual membership for users who need multiple views, and careful testing with the Redis adapter. **Recommendation:** defer unless profiling shows WS fan-out or client refetch cost as a bottleneck; debounced invalidation and small payloads already limit harm.

**Send-to-prep:** The API emits a single `order.sent_to_preparation` event (not a second `ticket.updated`) to avoid duplicate Redis/pub-sub fan-out for the same mutation.

**WS rate limiting:** Optional per-IP or per-socket message budgets in the Nest WebSocket layer (separate from HTTP throttling) only if abuse or noisy clients show up in metrics.

## References

- [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/)
- [Deployment checklist](./DEPLOYMENT_DEVOPS.md)
