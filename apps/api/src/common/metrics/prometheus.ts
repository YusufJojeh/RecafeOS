import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

const metricsEnabled = (): boolean => process.env.METRICS_ENABLED === 'true';

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

/** 4xx vs 5xx vs other for alert rules (e.g. rate of 5xx). */
const httpExceptionsTotal = new Counter({
  name: 'http_exceptions_total',
  help: 'HTTP layer exceptions (handled HttpException)',
  labelNames: ['status_class', 'code'],
  registers: [register],
});

/** Low-cardinality business signals (no raw branch_id / tenant_id labels). */
const businessEventsTotal = new Counter({
  name: 'restocafe_business_events_total',
  help: 'Domain events (orders, payments, audit, etc.)',
  labelNames: ['event'],
  registers: [register],
});

const websocketConnections = new Gauge({
  name: 'websocket_authenticated_connections',
  help: 'Authenticated Socket.IO connections in /ws namespace',
  registers: [register],
});

const websocketEventsEmitted = new Counter({
  name: 'websocket_branch_events_emitted_total',
  help: 'Realtime events emitted to branch rooms',
  labelNames: ['event'],
  registers: [register],
});

const unhandledErrorsTotal = new Counter({
  name: 'http_unhandled_errors_total',
  help: 'Uncaught non-HTTP exceptions in request pipeline',
  registers: [register],
});

/** Contention and concurrency observability. */
const contentionTotal = new Counter({
  name: 'restocafe_contention_total',
  help: 'Lock contention events (idempotency, optimistic, pessimistic)',
  labelNames: ['type'],
  registers: [register],
});

export function incHttpRequest(labels: {
  method: string;
  route: string;
  status: string;
}): void {
  if (!metricsEnabled()) {
    return;
  }
  httpRequestsTotal.inc(labels);
}

export function observeHttpDuration(
  labels: { method: string; route: string; status: string },
  seconds: number,
): void {
  if (!metricsEnabled()) {
    return;
  }
  httpRequestDurationSeconds.observe(labels, seconds);
}

export function incHttpException(status: number, code?: string): void {
  if (!metricsEnabled()) {
    return;
  }
  const statusClass =
    status >= 500
      ? '5xx'
      : status >= 400
        ? '4xx'
        : `${Math.floor(status / 100)}xx`;
  httpExceptionsTotal.inc({
    status_class: statusClass,
    code: code ?? 'unknown',
  });
}

export function incBusinessEvent(event: string): void {
  if (!metricsEnabled()) {
    return;
  }
  businessEventsTotal.inc({ event });
}

export function incUnhandledError(): void {
  if (!metricsEnabled()) {
    return;
  }
  unhandledErrorsTotal.inc();
}

export function wsConnectionDelta(delta: number): void {
  if (!metricsEnabled()) {
    return;
  }
  websocketConnections.inc(delta);
}

export function incWsBranchEmit(event: string): void {
  if (!metricsEnabled()) {
    return;
  }
  websocketEventsEmitted.inc({ event });
}

export function incContention(
  type:
    | 'idempotency_lock_wait'
    | 'idempotency_lock_timeout'
    | 'idempotency_cache_hit'
    | 'optimistic_conflict'
    | 'pessimistic_conflict',
): void {
  if (!metricsEnabled()) return;
  contentionTotal.inc({ type });
}

export function getPrometheusRegister(): Registry {
  return register;
}
