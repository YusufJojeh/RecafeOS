# Staging verification — Socket.IO (multi-replica)

Use before promoting a build that enables **multiple API replicas** or after changing realtime paths, Redis, or the load balancer.

**Prerequisites**

- `REDIS_URL` set identically on **every** API instance.
- Load balancer forwards **`/api`** and **`/socket.io`** to the API pool (WebSocket upgrade headers). See [`deploy/nginx/restocafe.conf.example`](../../deploy/nginx/restocafe.conf.example).

## Checklist

| Step | Pass? | Notes |
|------|-------|--------|
| 1. Health | [ ] | `GET /api/v1/health/ready` succeeds against **each** replica (direct or via LB). |
| 2. Two browsers, one branch | [ ] | Two ops-web sessions logged in, **same branch** selected. |
| 3. Realtime connectivity | [ ] | Both show realtime “connected” behavior (or confirm socket established in devtools Network → WS). |
| 4. Order / ticket event | [ ] | Create or update an order or ticket from one session; **both** sessions refresh or show updates (kitchen/bar/tables as applicable). |
| 5. Cross-replica emit | [ ] | If possible, pin one browser’s API calls to replica A and trigger an action handled by replica B (or use LB round-robin); **both** still receive the Socket.IO event. If you cannot pin replicas, at least confirm step 4 with two replicas running. |
| 6. Reconnect | [ ] | Briefly block network or restart one API pod; client reconnects and `joinBranch` restores updates (no permanent stale UI). |
| 7. Metrics / logs (optional) | [ ] | Prometheus `ws_*` counters or logs show connections and branch emits without error storms. |

## Evidence

- Date:
- Environment (staging URL):
- Replica count:
- Tester:

## Failure triage

- **One client never updates:** Check `REDIS_URL` on all pods; check LB `/socket.io` upgrade; check JWT and `joinBranch` errors in API logs.
- **Events only on one node:** Missing or misconfigured Redis adapter (wrong `REDIS_URL`, Redis unreachable from one pod).

See [`socket-io-scaling.md`](./socket-io-scaling.md) for architecture and rollout order.
