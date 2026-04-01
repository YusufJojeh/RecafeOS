import { useAuthStore } from './auth-store';

/**
 * Branch id from Zustand (subscribed). Prefer over `getBranchId()` from localStorage when
 * the UI must react to `setBranch` without a full route remount (e.g. future in-app branch switch).
 */
export function useBranchId(): string | null {
  return useAuthStore((s) => s.branchId);
}
