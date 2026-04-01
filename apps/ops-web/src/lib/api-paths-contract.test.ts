/**
 * Static contract test: every branchPaths / tenantPaths / customerPaths builder
 * must produce the exact URL template expected by the NestJS backend controllers.
 *
 * This runs in Vitest (jsdom), requires no DB, and takes < 200ms.
 * It exists to catch path drift between the frontend API layer and backend routes.
 */
import { describe, expect, it } from 'vitest';
import { publicGuestPaths } from './contract/public-guest-api';
import { branchPaths, customerPaths, tenantPaths } from './api';

// ---------------------------------------------------------------------------
// branchPaths — keep count in sync with branchPaths object + this suite
// ---------------------------------------------------------------------------
describe('branchPaths contract', () => {
  const B = 'b1';
  const T = 't1';

  it('tables', () => {
    expect(branchPaths.tables(B)).toBe(`/branches/${B}/tables`);
    expect(branchPaths.tableSessions(B)).toBe(`/branches/${B}/tables/sessions`);
    expect(branchPaths.tableSessionsMerge(B)).toBe(
      `/branches/${B}/tables/sessions/merge`,
    );
  });

  it('menuCategories', () => {
    expect(branchPaths.menuCategories(B)).toBe(`/branches/${B}/menu/categories`);
  });

  it('kitchenTickets — must include ?station=KITCHEN (KitchenController @Query default)', () => {
    expect(branchPaths.kitchenTickets(B)).toBe(
      `/branches/${B}/kitchen/tickets?station=KITCHEN`,
    );
  });

  it('barTickets — separate BarController route', () => {
    expect(branchPaths.barTickets(B)).toBe(`/branches/${B}/bar/tickets`);
  });

  it('kitchenTicket (PATCH path)', () => {
    expect(branchPaths.kitchenTicket(B, T)).toBe(
      `/branches/${B}/kitchen/tickets/${T}`,
    );
  });

  it('barTicket (PATCH path)', () => {
    expect(branchPaths.barTicket(B, T)).toBe(`/branches/${B}/bar/tickets/${T}`);
  });

  it('inventoryStock', () => {
    expect(branchPaths.inventoryStock(B)).toBe(`/branches/${B}/inventory/stock`);
  });

  it('reportsDaily — no date arg', () => {
    expect(branchPaths.reportsDaily(B)).toBe(`/branches/${B}/reports/daily`);
  });

  it('reportsDaily — with date', () => {
    expect(branchPaths.reportsDaily(B, '2026-03-25')).toBe(
      `/branches/${B}/reports/daily?date=2026-03-25`,
    );
  });

  it('reportsWeeklyDigest', () => {
    expect(branchPaths.reportsWeeklyDigest(B)).toBe(
      `/branches/${B}/reports/weekly-digest`,
    );
  });

  it('reportsDemandProfile — no days', () => {
    expect(branchPaths.reportsDemandProfile(B)).toBe(
      `/branches/${B}/reports/demand-profile`,
    );
  });

  it('reportsDemandProfile — with days', () => {
    expect(branchPaths.reportsDemandProfile(B, 28)).toBe(
      `/branches/${B}/reports/demand-profile?days=28`,
    );
  });

  it('openOrders', () => {
    expect(branchPaths.openOrders(B)).toBe(`/branches/${B}/orders`);
  });

  it('onboardingStatus — under /tenants/branches', () => {
    expect(branchPaths.onboardingStatus(B)).toBe(
      `/tenants/branches/${B}/onboarding-status`,
    );
  });

  it('configSnapshot — under /tenants/branches', () => {
    expect(branchPaths.configSnapshot(B)).toBe(
      `/tenants/branches/${B}/config-snapshot`,
    );
  });

  it('patchBranch — under /tenants/branches', () => {
    expect(branchPaths.patchBranch(B)).toBe(`/tenants/branches/${B}`);
  });

  it('onboardingUi — under /tenants/branches', () => {
    expect(branchPaths.onboardingUi(B)).toBe(
      `/tenants/branches/${B}/onboarding-ui`,
    );
  });

  it('goLiveAck — under /tenants/branches', () => {
    expect(branchPaths.goLiveAck(B)).toBe(`/tenants/branches/${B}/go-live-ack`);
  });

  it('menuImportDryRun', () => {
    expect(branchPaths.menuImportDryRun(B)).toBe(
      `/branches/${B}/menu/import/dry-run`,
    );
  });

  it('menuImportApply', () => {
    expect(branchPaths.menuImportApply(B)).toBe(
      `/branches/${B}/menu/import/apply`,
    );
  });

  it('setupReadiness — under /tenants/branches', () => {
    expect(branchPaths.setupReadiness(B)).toBe(
      `/tenants/branches/${B}/setup-readiness`,
    );
  });

  it('opsSnapshot — under /tenants/branches', () => {
    expect(branchPaths.opsSnapshot(B)).toBe(
      `/tenants/branches/${B}/ops-snapshot`,
    );
  });

  it('customerVisitSignals', () => {
    expect(branchPaths.customerVisitSignals(B)).toBe(
      `/branches/${B}/customers/visit-signals`,
    );
  });

  it('customersBranchSearch — no query', () => {
    expect(branchPaths.customersBranchSearch(B)).toBe(
      `/branches/${B}/customers/search`,
    );
  });

  it('customersBranchSearch — with query', () => {
    expect(branchPaths.customersBranchSearch(B, 'alice')).toBe(
      `/branches/${B}/customers/search?q=alice`,
    );
  });
});

// ---------------------------------------------------------------------------
// tenantPaths — keep in sync with api.ts tenantPaths
// ---------------------------------------------------------------------------
describe('tenantPaths contract', () => {
  it('pushDevices', () => {
    expect(tenantPaths.pushDevices()).toBe('/tenants/push-devices');
  });

  it('commerce', () => {
    expect(tenantPaths.commerce()).toBe('/tenants/commerce');
  });

  it('pilotFeedback', () => {
    expect(tenantPaths.pilotFeedback()).toBe('/tenants/pilot-feedback');
  });

  it('invites', () => {
    expect(tenantPaths.invites()).toBe('/tenants/invites');
  });

  it('tenantRollup — no params', () => {
    expect(tenantPaths.tenantRollup()).toBe('/tenants/reports/tenant-rollup');
  });

  it('tenantRollup — with from/to', () => {
    expect(tenantPaths.tenantRollup('2026-01-01', '2026-01-31')).toBe(
      '/tenants/reports/tenant-rollup?from=2026-01-01&to=2026-01-31',
    );
  });

  it('branchSnapshot', () => {
    expect(tenantPaths.branchSnapshot('2026-03-25')).toBe(
      '/tenants/reports/branch-snapshot?date=2026-03-25',
    );
  });

  it('repeatCustomers — no days', () => {
    expect(tenantPaths.repeatCustomers()).toBe(
      '/tenants/reports/repeat-customers',
    );
  });

  it('repeatCustomers — with days', () => {
    expect(tenantPaths.repeatCustomers(90)).toBe(
      '/tenants/reports/repeat-customers?days=90',
    );
  });

  it('archiveStaleCustomerVisits — no years', () => {
    expect(tenantPaths.archiveStaleCustomerVisits()).toBe(
      '/tenants/reports/archive-stale-customer-visits',
    );
  });

  it('archiveStaleCustomerVisits — with years', () => {
    expect(tenantPaths.archiveStaleCustomerVisits(7)).toBe(
      '/tenants/reports/archive-stale-customer-visits?years=7',
    );
  });
});

// ---------------------------------------------------------------------------
// customerPaths — all 5 entries
// ---------------------------------------------------------------------------
describe('customerPaths contract', () => {
  const ID = 'cust-123';

  it('search — no query', () => {
    expect(customerPaths.search()).toBe('/customers/search');
  });

  it('search — with query', () => {
    expect(customerPaths.search('bob')).toBe('/customers/search?q=bob');
  });

  it('detail', () => {
    expect(customerPaths.detail(ID)).toBe(`/customers/${ID}`);
  });

  it('patch', () => {
    expect(customerPaths.patch(ID)).toBe(`/customers/${ID}`);
  });

  it('addNote', () => {
    expect(customerPaths.addNote(ID)).toBe(`/customers/${ID}/notes`);
  });

  it('addOffer', () => {
    expect(customerPaths.addOffer(ID)).toBe(`/customers/${ID}/offers`);
  });
});

// ---------------------------------------------------------------------------
// publicGuestPaths — `PublicController` (`apps/api/src/modules/public/public.controller.ts`)
// ---------------------------------------------------------------------------
describe('publicGuestPaths contract', () => {
  it('branchMenu, sessionMenu, sessionOrder, sessionOrderStatus', () => {
    expect(publicGuestPaths.branchMenu('demo', 'main')).toBe(
      '/public/tenants/demo/branches/main/menu',
    );
    expect(publicGuestPaths.sessionMenu('demo', 'main', 'tok')).toBe(
      '/public/tenants/demo/branches/main/sessions/tok/menu',
    );
    expect(publicGuestPaths.sessionOrder('demo', 'main', 'tok')).toBe(
      '/public/tenants/demo/branches/main/sessions/tok/order',
    );
    expect(publicGuestPaths.sessionOrderStatus('demo', 'main', 'tok', 'ord1')).toBe(
      '/public/tenants/demo/branches/main/sessions/tok/orders/ord1',
    );
  });
});
