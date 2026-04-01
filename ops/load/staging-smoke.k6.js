/**
 * Staging smoke load: authenticated hot paths.
 * Requires: BASE_URL, JWT, BRANCH_ID
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const base = __ENV.BASE_URL || 'http://localhost:3000';
const token = __ENV.JWT || '';
const branchId = __ENV.BRANCH_ID || '';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500'],
  },
};

const headers = {
  Authorization: `Bearer ${token}`,
  'X-Branch-Id': branchId,
  'Content-Type': 'application/json',
};

export default function () {
  if (!token || !branchId) {
    console.warn('Set JWT and BRANCH_ID for meaningful results');
  }

  const h = http.get(`${base}/api/v1/health/live`);
  check(h, { 'health live 200': (r) => r.status === 200 });

  const tickets = http.get(
    `${base}/api/v1/branches/${branchId}/kitchen/tickets?station=KITCHEN`,
    { headers },
  );
  check(tickets, { 'kitchen tickets 200': (r) => r.status === 200 });

  const tables = http.get(`${base}/api/v1/branches/${branchId}/tables`, {
    headers,
  });
  check(tables, { 'tables 200': (r) => r.status === 200 });

  sleep(1);
}
