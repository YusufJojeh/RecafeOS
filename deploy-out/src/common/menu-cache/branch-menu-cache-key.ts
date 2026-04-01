/**
 * Canonical Redis key for a branch’s full menu payload when (if) cross-replica menu caching is implemented.
 * {@link BranchMenuCacheInvalidationService} deletes this key on every menu mutation so stale prices/availability cannot persist.
 */
export function branchMenuCacheRedisKey(branchId: string): string {
  return `rc:menu:branch:v1:${branchId}`;
}
