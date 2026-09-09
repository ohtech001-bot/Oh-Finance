import type { ApiRequestError } from '@/lib/api';

export function loginErrorMessage(
  error: ApiRequestError,
  translate: (key: string) => string,
): string {
  if (error.code === 'INVALID_CREDENTIALS') return translate('auth.invalidCredentials');
  if (error.code === 'RATE_LIMITED' || error.status === 429) return translate('auth.rateLimited');
  return error.message || translate('errors.generic');
}
