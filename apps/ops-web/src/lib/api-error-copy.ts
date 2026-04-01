import { ApiError } from './api';

type ApiErrorCopyOptions = {
  fallback: string;
  byStatus?: Partial<Record<number, string>>;
};

export function describeApiError(
  error: unknown,
  options: ApiErrorCopyOptions,
): string {
  if (error instanceof ApiError) {
    const mapped = options.byStatus?.[error.status];
    if (mapped) {
      return mapped;
    }
    return error.message || options.fallback;
  }
  return error instanceof Error ? error.message : options.fallback;
}
