import { Logger, Module, ServiceUnavailableException } from '@nestjs/common';
import {
  ThrottlerModule,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';
import { AppConfigModule } from '../config/config.module.js';
import { EnvService } from '../config/env.service.js';

const logger = new Logger('RedisRateLimitStorage');

export class FailClosedRedisStorage implements ThrottlerStorage {
  constructor(private readonly storage: ThrottlerStorage) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    try {
      return await this.storage.increment(key, ttl, limit, blockDuration, throttlerName);
    } catch (error) {
      logger.error('Redis rate-limit operation failed; request denied safely.', error);
      throw new ServiceUnavailableException('خدمة حماية الطلبات غير متاحة مؤقتًا.');
    }
  }
}

export async function createRateLimitOptions(env: EnvService): Promise<ThrottlerModuleOptions> {
  const throttlers = [
    {
      name: 'default',
      ttl: env.get('RATE_LIMIT_TTL_SECONDS') * 1000,
      limit: env.get('RATE_LIMIT_MAX'),
    },
  ];
  const redisUrl = env.get('REDIS_URL');

  if (!redisUrl) {
    logger.warn('REDIS_URL is not configured; using in-memory throttling outside production.');
    return throttlers;
  }

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 5_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  });
  redis.on('error', (error) => logger.error('Redis rate-limit connection error.', error));

  try {
    await redis.connect();
    await redis.ping();
  } catch (error) {
    redis.disconnect(false);
    logger.error('Redis rate-limit startup check failed; API startup aborted.', error);
    throw error;
  }

  logger.log('Distributed Redis rate limiting is ready.');
  return {
    throttlers,
    storage: new FailClosedRedisStorage(new ThrottlerStorageRedisService(redis)),
  };
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [EnvService],
      useFactory: createRateLimitOptions,
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
