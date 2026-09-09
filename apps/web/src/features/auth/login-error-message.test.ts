import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '@/lib/api';
import { loginErrorMessage } from './login-error-message';

const translate = (key: string) => key;

describe('loginErrorMessage', () => {
  it('uses the credentials message only for INVALID_CREDENTIALS', () => {
    const error = new ApiRequestError(401, 'INVALID_CREDENTIALS', 'server message');
    expect(loginErrorMessage(error, translate)).toBe('auth.invalidCredentials');
  });

  it('uses the waiting message for rate limiting', () => {
    const error = new ApiRequestError(429, 'RATE_LIMITED', 'server message');
    expect(loginErrorMessage(error, translate)).toBe('auth.rateLimited');
  });

  it.each([
    new ApiRequestError(403, 'FORBIDDEN', 'غير مسموح'),
    new ApiRequestError(503, 'INTERNAL', 'الخدمة غير متاحة'),
  ])('does not disguise HTTP $status as invalid credentials', (error) => {
    expect(loginErrorMessage(error, translate)).toBe(error.message);
  });
});
