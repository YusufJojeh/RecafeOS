import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_ANY_KEY = 'permissions_any';

/** Caller must have at least one of the listed permission codes. */
export const RequireAnyPermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
