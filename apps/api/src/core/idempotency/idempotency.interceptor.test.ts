import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import type { IdempotencyService } from './idempotency.service.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';

afterEach(() => vi.restoreAllMocks());

function fixture() {
  vi.spyOn(TenantContext, 'requireTenantId').mockReturnValue('tenant');
  const service = {
    acquire: vi.fn().mockResolvedValue({ acquired: true, recordId: 'record' }),
    complete: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };
  const interceptor = new IdempotencyInterceptor(
    { getAllAndOverride: () => true } as unknown as Reflector,
    service as unknown as IdempotencyService,
    {
      runInTenant: (_id: string, fn: (tx: unknown) => unknown) => fn({}),
    } as unknown as PrismaService,
  );
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { 'idempotency-key': 'test-key-123' },
        method: 'POST',
        path: '/payments',
        body: {},
      }),
    }),
  } as unknown as ExecutionContext;
  return { service, interceptor, context };
}

describe('financial idempotency failure handling', () => {
  it('retains the reservation when saving a successful response fails', async () => {
    const { service, interceptor, context } = fixture();
    service.complete.mockRejectedValue(new Error('response storage failed'));
    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => of({ id: 'payment' }) })),
    ).rejects.toThrow('response storage failed');
    expect(service.release).not.toHaveBeenCalled();
  });
  it('releases a reservation when the financial handler itself fails', async () => {
    const { service, interceptor, context } = fixture();
    await expect(
      lastValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => new Error('transaction rolled back')),
        }),
      ),
    ).rejects.toThrow('transaction rolled back');
    expect(service.release).toHaveBeenCalledWith('tenant', 'record');
    expect(service.complete).not.toHaveBeenCalled();
  });
});
