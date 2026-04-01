declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      displayName: string;
      tenantId: string;
      permissions: string[];
    }

    interface Request {
      branchId?: string;
      /** Correlation id (Pino genReqId / x-request-id) */
      requestId?: string;
    }
  }
}

export {};
