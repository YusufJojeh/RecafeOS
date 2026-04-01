import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './auth-store';

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store and localStorage between tests
    useAuthStore.getState().clear();
    localStorage.clear();
  });

  it('initialises with nulls when localStorage is empty', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.tenantId).toBeNull();
    expect(state.branchId).toBeNull();
    expect(state.preferredTenantSlug).toBeNull();
  });

  it('setSession stores tokens in state and localStorage', () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok_access',
      refreshToken: 'tok_refresh',
      tenantId: 'tenant_1',
    });
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('tok_access');
    expect(state.refreshToken).toBe('tok_refresh');
    expect(state.tenantId).toBe('tenant_1');
    expect(localStorage.getItem('accessToken')).toBe('tok_access');
    expect(localStorage.getItem('refreshToken')).toBe('tok_refresh');
    expect(localStorage.getItem('tenantId')).toBe('tenant_1');
  });

  it('setSession clears stale branch selection', () => {
    useAuthStore.getState().setBranch('branch_old');

    useAuthStore.getState().setSession({
      accessToken: 'tok_access',
      refreshToken: 'tok_refresh',
      tenantId: 'tenant_1',
    });

    expect(useAuthStore.getState().branchId).toBeNull();
    expect(localStorage.getItem('branchId')).toBeNull();
  });

  it('setSession stores tenantSlug when provided', () => {
    useAuthStore.getState().setSession({
      accessToken: 'a',
      refreshToken: 'b',
      tenantId: 'c',
      tenantSlug: 'my-org',
    });
    const state = useAuthStore.getState();
    expect(state.preferredTenantSlug).toBe('my-org');
    expect(localStorage.getItem('preferredTenantSlug')).toBe('my-org');
  });

  it('setSession does not overwrite preferredTenantSlug when slug is omitted', () => {
    useAuthStore.getState().setSession({
      accessToken: 'x',
      refreshToken: 'y',
      tenantId: 'z',
      tenantSlug: 'prior-slug',
    });
    useAuthStore.getState().setSession({
      accessToken: 'x2',
      refreshToken: 'y2',
      tenantId: 'z2',
    });
    // State slug comes from first call, not cleared by second
    expect(useAuthStore.getState().preferredTenantSlug).toBe('prior-slug');
  });

  it('setBranch stores branchId in state and localStorage', () => {
    useAuthStore.getState().setBranch('branch_abc');
    expect(useAuthStore.getState().branchId).toBe('branch_abc');
    expect(localStorage.getItem('branchId')).toBe('branch_abc');
  });

  it('clearBranch removes branchId from state and localStorage', () => {
    useAuthStore.getState().setSession({
      accessToken: 'a',
      refreshToken: 'b',
      tenantId: 't',
    });
    useAuthStore.getState().setBranch('branch_abc');
    useAuthStore.getState().clearBranch();
    expect(useAuthStore.getState().branchId).toBeNull();
    expect(localStorage.getItem('branchId')).toBeNull();
    expect(useAuthStore.getState().accessToken).toBe('a');
  });

  it('refreshSession preserves branch selection while rotating tokens', () => {
    useAuthStore.getState().setSession({
      accessToken: 'a',
      refreshToken: 'b',
      tenantId: 'tenant_1',
      tenantSlug: 'org-a',
    });
    useAuthStore.getState().setBranch('branch_abc');

    useAuthStore.getState().refreshSession({
      accessToken: 'a2',
      refreshToken: 'b2',
      tenantId: 'tenant_1',
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('a2');
    expect(state.refreshToken).toBe('b2');
    expect(state.branchId).toBe('branch_abc');
    expect(state.preferredTenantSlug).toBe('org-a');
    expect(localStorage.getItem('branchId')).toBe('branch_abc');
  });

  it('clear removes all values from state and localStorage', () => {
    useAuthStore.getState().setSession({
      accessToken: 'a',
      refreshToken: 'b',
      tenantId: 'c',
      tenantSlug: 'd',
    });
    useAuthStore.getState().setBranch('e');

    useAuthStore.getState().clear();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.tenantId).toBeNull();
    expect(state.branchId).toBeNull();
    expect(state.preferredTenantSlug).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('branchId')).toBeNull();
    expect(localStorage.getItem('preferredTenantSlug')).toBeNull();
  });
});
