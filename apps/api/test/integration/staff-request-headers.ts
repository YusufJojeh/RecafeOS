import {
  STAFF_HTTP_HEADER,
  staffAuthorizationBearer,
} from '@restocafe/types';

/** Standard staff REST headers for supertest and `request()`. */
export function staffAuthHeaders(accessToken: string, branchId: string) {
  return {
    [STAFF_HTTP_HEADER.AUTHORIZATION]: staffAuthorizationBearer(accessToken),
    [STAFF_HTTP_HEADER.BRANCH_ID]: branchId,
  };
}

/** Branch routes without `X-Branch-Id` (negative tests). */
export function staffBearerOnlyHeaders(accessToken: string) {
  return {
    [STAFF_HTTP_HEADER.AUTHORIZATION]: staffAuthorizationBearer(accessToken),
  };
}
