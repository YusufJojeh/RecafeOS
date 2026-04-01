import { describe, expect, it, vi } from 'vitest';
import { branchPaths, customerPaths, getSocketBaseUrl, tenantPaths } from './api';

describe('api path builders', () => {
  it('builds branch report paths with optional params', () => {
    expect(branchPaths.reportsDaily('b1')).toBe('/branches/b1/reports/daily');
    expect(branchPaths.reportsDaily('b1', '2026-03-24')).toContain('date=2026-03-24');
    expect(branchPaths.reportsDemandProfile('b1', 28)).toContain('days=28');
  });

  it('builds all branch operation paths', () => {
    expect(branchPaths.tables('b1')).toBe('/branches/b1/tables');
    expect(branchPaths.menuCategories('b1')).toBe('/branches/b1/menu/categories');
    expect(branchPaths.kitchenTickets('b1')).toContain('/branches/b1/kitchen/tickets');
    expect(branchPaths.barTickets('b1')).toBe('/branches/b1/bar/tickets');
    expect(branchPaths.kitchenTicket('b1', 't1')).toBe('/branches/b1/kitchen/tickets/t1');
    expect(branchPaths.barTicket('b1', 't1')).toBe('/branches/b1/bar/tickets/t1');
    expect(branchPaths.inventoryStock('b1')).toBe('/branches/b1/inventory/stock');
    expect(branchPaths.reportsWeeklyDigest('b1')).toBe('/branches/b1/reports/weekly-digest');
    expect(branchPaths.openOrders('b1')).toBe('/branches/b1/orders');
    expect(branchPaths.onboardingStatus('b1')).toBe('/tenants/branches/b1/onboarding-status');
    expect(branchPaths.configSnapshot('b1')).toBe('/tenants/branches/b1/config-snapshot');
    expect(branchPaths.patchBranch('b1')).toBe('/tenants/branches/b1');
    expect(branchPaths.onboardingUi('b1')).toBe('/tenants/branches/b1/onboarding-ui');
    expect(branchPaths.goLiveAck('b1')).toBe('/tenants/branches/b1/go-live-ack');
    expect(branchPaths.menuImportDryRun('b1')).toBe('/branches/b1/menu/import/dry-run');
    expect(branchPaths.menuImportApply('b1')).toBe('/branches/b1/menu/import/apply');
    expect(branchPaths.setupReadiness('b1')).toBe('/tenants/branches/b1/setup-readiness');
    expect(branchPaths.opsSnapshot('b1')).toBe('/tenants/branches/b1/ops-snapshot');
    expect(branchPaths.customerVisitSignals('b1')).toBe('/branches/b1/customers/visit-signals');
    expect(branchPaths.customersBranchSearch('b1')).toBe('/branches/b1/customers/search');
    expect(branchPaths.customersBranchSearch('b1', 'john')).toContain('q=john');
  });

  it('builds tenant report paths with optional params', () => {
    expect(tenantPaths.tenantRollup()).toBe('/tenants/reports/tenant-rollup');
    expect(tenantPaths.tenantRollup('2026-01-01', '2026-01-07')).toContain('from=2026-01-01');
    expect(tenantPaths.repeatCustomers(90)).toContain('days=90');
    expect(tenantPaths.archiveStaleCustomerVisits(7)).toContain('years=7');
    expect(tenantPaths.commerce()).toBe('/tenants/commerce');
    expect(tenantPaths.pilotFeedback()).toBe('/tenants/pilot-feedback');
    expect(tenantPaths.invites()).toBe('/tenants/invites');
    expect(tenantPaths.branchSnapshot('2026-01-01')).toContain('date=2026-01-01');
  });

  it('builds customer paths with optional search query', () => {
    expect(customerPaths.search()).toBe('/customers/search');
    expect(customerPaths.search('abc')).toContain('q=abc');
    expect(customerPaths.detail('c1')).toBe('/customers/c1');
    expect(customerPaths.patch('c1')).toBe('/customers/c1');
    expect(customerPaths.addNote('c1')).toBe('/customers/c1/notes');
    expect(customerPaths.addOffer('c1')).toBe('/customers/c1/offers');
  });

  it('falls back to window origin when VITE_API_URL is absent', () => {
    const oldWindow = global.window;
    // @ts-expect-error test shim
    global.window = { location: { origin: 'http://localhost:5173' } };
    expect(getSocketBaseUrl()).toBe('http://localhost:5173');
    global.window = oldWindow;
  });

  it('uses absolute origin when VITE_API_URL is absolute', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api/v1');
    expect(getSocketBaseUrl()).toBe('https://api.example.com');
    vi.unstubAllEnvs();
  });
});
