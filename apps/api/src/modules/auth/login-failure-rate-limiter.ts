import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { EnvService } from '../../core/config/env.service.js';
import { AppError } from '../../core/errors/app-error.js';

const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export interface LoginFailureCounterStore {
  increment(key: string, ttlMs: number): Promise<{ attempts: number; ttlMs: number }>;
  clear(key: string): Promise<void>;
  close?(): void;
}

export const LOGIN_FAILURE_COUNTER_STORE = Symbol('LOGIN_FAILURE_COUNTER_STORE');

class MemoryLoginFailureCounterStore implements LoginFailureCounterStore {
  private readonly entries = new Map<string, { attempts: number; expiresAt: number }>();

  async increment(key: string, ttlMs: number): Promise<{ attempts: number; ttlMs: number }> {
    const now = Date.now();
    const current = this.entries.get(key);
    const entry = !current || current.expiresAt <= now
      ? { attempts: 1, expiresAt: now + ttlMs }
      : { attempts: current.attempts + 1, expiresAt: current.expiresAt };
    this.entries.set(key, entry);
    return { attempts: entry.attempts, ttlMs: Math.max(0, entry.expiresAt - now) };
  }

  async clear(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

class RedisLoginFailureCounterStore implements LoginFailureCounterStore {
  private readonly redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, {
      connectTimeout: 5_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });
  }

  async increment(key: string, ttlMs: number): Promise<{ attempts: number; ttlMs: number }> {
    const result = await this.redis.eval(
      `
        local attempts = redis.call('INCR', KEYS[1])
        if attempts == 1 then
          redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        return { attempts, redis.call('PTTL', KEYS[1]) }
      `,
      1,
      key,
      ttlMs,
    );
    if (!Array.isArray(result) || typeof result[0] !== 'number' || typeof result[1] !== 'number') {
      throw new TypeError('Unexpected Redis login-failure counter response.');
    }
    return { attempts: result[0], ttlMs: result[1] };
  }

  async clear(key: string): Promise<void> {
    await this.redis.del(key);
  }

  close(): void {
    this.redis.disconnect(false);
  }
}

@Injectable()
export class LoginFailureRateLimiter implements OnModuleDestroy {
  private readonly logger = new Logger(LoginFailureRateLimiter.name);
  private readonly store: LoginFailureCounterStore;
  private readonly limit: number;

  constructor(
    env: EnvService,
    @Optional()
    @Inject(LOGIN_FAILURE_COUNTER_STORE)
    store?: LoginFailureCounterStore,
  ) {
    const redisUrl = env.get('REDIS_URL');
    this.store = store ?? (redisUrl
      ? new RedisLoginFailureCounterStore(redisUrl)
      : new MemoryLoginFailureCounterStore());
    this.limit = env.get('AUTH_RATE_LIMIT_MAX');
  }

  async registerFailure(email: string, ip: string | null): Promise<void> {
    try {
      const result = await this.store.increment(this.key(email, ip), FAILURE_WINDOW_MS);
      if (result.attempts >= this.limit) {
        throw AppError.rateLimited(Math.max(1, Math.ceil(result.ttlMs / 1000)));
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Redis login-failure counter operation failed.', error);
      throw new ServiceUnavailableException('خدمة حماية تسجيل الدخول غير متاحة مؤقتًا.');
    }
  }

  async clear(email: string, ip: string | null): Promise<void> {
    try {
      await this.store.clear(this.key(email, ip));
    } catch (error) {
      this.logger.error('Redis login-failure counter reset failed.', error);
      throw new ServiceUnavailableException('خدمة حماية تسجيل الدخول غير متاحة مؤقتًا.');
    }
  }

  onModuleDestroy(): void {
    this.store.close?.();
  }

  private key(email: string, ip: string | null): string {
    const normalizedEmail = email.trim().toLowerCase();
    const digest = createHash('sha256')
      .update(`${ip ?? 'unknown'}\u0000${normalizedEmail}`)
      .digest('hex');
    return `auth:login-fail:v1:${digest}`;
  }
}
