import { ServiceUnavailableException } from '@nestjs/common';
import type { ThrottlerStorage, ThrottlerStorageRecord } from '@nestjs/throttler';
import { describe, expect, it, vi } from 'vitest';
import { FailClosedRedisStorage } from './rate-limit.module.js';

class SharedStorage implements ThrottlerStorage {
  private static readonly hits = new Map<string, number>();

  async increment(
    key: string,
    _ttl: number,
    _limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const totalHits = (SharedStorage.hits.get(key) ?? 0) + 1;
    SharedStorage.hits.set(key, totalHits);
    return { totalHits, timeToExpire: 60_000, isBlocked: false, timeToBlockExpire: 0 };
  }
}

describe('FailClosedRedisStorage', () => {
  it('shares one logical counter between separate runtime adapters', async () => {
    const firstRuntime = new FailClosedRedisStorage(new SharedStorage());
    const secondRuntime = new FailClosedRedisStorage(new SharedStorage());

    const first = await firstRuntime.increment('shared-client', 60_000, 120, 0, 'default');
    const second = await secondRuntime.increment('shared-client', 60_000, 120, 0, 'default');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
  });

  it('fails closed with 503 when the backing store is unavailable', async () => {
    const backing = {
      increment: vi.fn().mockRejectedValue(new Error('redis unavailable')),
    } as unknown as ThrottlerStorage;
    const storage = new FailClosedRedisStorage(backing);

    await expect(storage.increment('client', 60_000, 120, 0, 'default')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
