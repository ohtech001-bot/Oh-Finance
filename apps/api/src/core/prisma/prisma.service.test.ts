import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma.service.js';
import { TenantContext } from '../tenancy/tenant-context.js';

const mocks = vi.hoisted(() => ({
  execute: vi.fn().mockResolvedValue(1),
  transaction: vi.fn(),
}));
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    $transaction = mocks.transaction;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn) => fn({ $executeRaw: mocks.execute }));
});

describe('transaction-local RLS setup', () => {
  it('sets the restricted role and bound tenant parameter in one round trip before business queries', async () => {
    const service = new PrismaService();
    const work = vi.fn().mockImplementation(async () => {
      expect(mocks.execute).toHaveBeenCalledOnce();
      return 'result';
    });
    expect(await service.runInTenant('tenant-id', work)).toBe('result');
    const [strings, tenantId] = mocks.execute.mock.calls[0]!;
    expect(strings.join('?')).toContain("set_config('role', 'oh_app', true)");
    expect(strings.join('?')).toContain("set_config('app.tenant_id', ?::text, true)");
    expect(tenantId).toBe('tenant-id');
    expect(mocks.transaction.mock.calls[0]?.[1]).toEqual({ maxWait: 5_000, timeout: 10_000 });
  });

  it('keeps the platform guard and applies the platform scope only inside its transaction', async () => {
    const service = new PrismaService();
    vi.spyOn(TenantContext, 'isSuperAdmin').mockReturnValue(false);
    await expect(service.runAsPlatform(async () => 1)).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
    vi.mocked(TenantContext.isSuperAdmin).mockReturnValue(true);
    expect(await service.runAsPlatform(async () => 1)).toBe(1);
    const sql = mocks.execute.mock.calls[0]?.[0].join('');
    expect(sql).toContain("set_config('role', 'oh_app', true)");
    expect(sql).toContain("set_config('app.is_platform', 'on', true)");
    vi.restoreAllMocks();
  });

  it('does not run business work if setting the restricted context fails', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('context failed'));
    const work = vi.fn();
    await expect(new PrismaService().runInTenant('tenant', work)).rejects.toThrow('context failed');
    expect(work).not.toHaveBeenCalled();
  });
});
