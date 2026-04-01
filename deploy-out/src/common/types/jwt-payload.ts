export interface JwtAccessPayload {
  sub: string;
  tenantId: string;
  permissions: string[];
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  tokenId: string;
  /** Required for refresh rotation; binds session to one tenant when user has multiple memberships. */
  tenantId: string;
  type: 'refresh';
}
