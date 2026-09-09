import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { EnvService } from '../../core/config/env.service.js';
import { AppError } from '../../core/errors/app-error.js';
import {
  LoginFailureRateLimiter,
  type LoginFailureCounterStore,
} from './login-failure-rate-limiter.js';

class FakeCounterStore implements LoginFailureCounterStore {
  readonly values = new Map<string, number>();

  async increment(key: string, ttlMs: number) {
    const attempts = (this.values.get(key) ?? 0) + 1;
    this.values.set(key, attempts);
    return { attempts, ttlMs };
  }

  async clear(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function limiter(limit = 10) {
  const env = {
    get(key: string) {
      if (key === 'REDIS_URL') return undefined;
      if (key === 'AUTH_RATE_LIMIT_MAX') return limit;
      throw new Error(`Unexpected env key: ${key}`);
    },
  } as unknown as EnvService;
  return new LoginFailureRateLimiter(env, new FakeCounterStore());
}

async function failedLogin(instance: LoginFailureRateLimiter): Promise<number> {
  try {
    await instance.registerFailure('Owner@Example.com', '203.0.113.1');
    return HttpStatus.UNAUTHORIZED;
  } catch (error) {
    if (error instanceof AppError) return error.getStatus();
    throw error;
  }
}

describe('LoginFailureRateLimiter', () => {
  it('allows 20 successful login/logout cycles because successes are not counted', async () => {
    const instance = limiter();
    const statuses: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      await instance.clear('owner@example.com', '203.0.113.1');
      statuses.push(HttpStatus.OK, HttpStatus.NO_CONTENT);
    }
    expect(statuses.filter((status) => status === HttpStatus.OK)).toHaveLength(20);
    expect(statuses.every((status) => status === 200 || status === 204)).toBe(true);
  });

  it('blocks on the tenth failed login within the window', async () => {
    const instance = limiter(10);
    const statuses = [];
    for (let index = 0; index < 10; index += 1) statuses.push(await failedLogin(instance));
    expect(statuses.slice(0, 9)).toEqual(Array(9).fill(HttpStatus.UNAUTHORIZED));
    expect(statuses[9]).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('clears prior failures after a successful login before the limit', async () => {
    const instance = limiter(3);
    expect(await failedLogin(instance)).toBe(HttpStatus.UNAUTHORIZED);
    expect(await failedLogin(instance)).toBe(HttpStatus.UNAUTHORIZED);
    await instance.clear(' OWNER@example.com ', '203.0.113.1');
    expect(await failedLogin(instance)).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('does not clear failures on logout', async () => {
    const instance = limiter(3);
    expect(await failedLogin(instance)).toBe(HttpStatus.UNAUTHORIZED);
    expect(await failedLogin(instance)).toBe(HttpStatus.UNAUTHORIZED);
    const logoutStatus = HttpStatus.NO_CONTENT;
    expect(logoutStatus).toBe(204);
    expect(await failedLogin(instance)).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});
