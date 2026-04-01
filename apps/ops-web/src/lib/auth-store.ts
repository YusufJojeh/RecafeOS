import { create } from 'zustand';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  tenantId: string | null;
  branchId: string | null;
  /** Remembered tenant slug for multi-tenant staff login. */
  preferredTenantSlug: string | null;
  setSession: (p: {
    accessToken: string;
    refreshToken: string;
    tenantId: string;
    tenantSlug?: string;
  }) => void;
  refreshSession: (p: {
    accessToken: string;
    refreshToken: string;
    tenantId: string;
  }) => void;
  setBranch: (branchId: string) => void;
  clearBranch: () => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  tenantId: localStorage.getItem('tenantId'),
  branchId: localStorage.getItem('branchId'),
  preferredTenantSlug: localStorage.getItem('preferredTenantSlug'),
  setSession: ({ accessToken, refreshToken, tenantId, tenantSlug }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('tenantId', tenantId);
    localStorage.removeItem('branchId');
    if (tenantSlug) {
      localStorage.setItem('preferredTenantSlug', tenantSlug);
    }
    set({
      accessToken,
      refreshToken,
      tenantId,
      branchId: null,
      ...(tenantSlug ? { preferredTenantSlug: tenantSlug } : {}),
    });
  },
  refreshSession: ({ accessToken, refreshToken, tenantId }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('tenantId', tenantId);
    set({
      accessToken,
      refreshToken,
      tenantId,
    });
  },
  setBranch: (branchId) => {
    localStorage.setItem('branchId', branchId);
    set({ branchId });
  },
  clearBranch: () => {
    localStorage.removeItem('branchId');
    set({ branchId: null });
  },
  clear: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('branchId');
    localStorage.removeItem('preferredTenantSlug');
    set({
      accessToken: null,
      refreshToken: null,
      tenantId: null,
      branchId: null,
      preferredTenantSlug: null,
    });
  },
}));
