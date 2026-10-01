import { QueryClient } from '@tanstack/react-query';
import type { SessionUser } from '@oh/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import type * as ApiModule from '@/lib/api';
import { customersQueryOptions } from '@/features/customers/api';
import { prefetchNavigationData } from './navigation-prefetch';

vi.mock('./route-prefetch', () => ({ prefetchRoute: vi.fn() }));
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  api: { get: vi.fn().mockResolvedValue({ items: [], total: 0 }) },
}));

const user = { isSuperAdmin: false, permissions: ['customers.read', 'orders.read'] } as SessionUser;
const clients: QueryClient[] = [];
function client() {
  const result = new QueryClient({ defaultOptions: { queries: { staleTime: 300_000 } } });
  clients.push(result);
  return result;
}

afterEach(() => {
  clients.forEach((qc) => qc.clear());
  clients.length = 0;
  vi.clearAllMocks();
});

describe('navigation data warming', () => {
  it('deduplicates hover/focus requests and reuses the exact page cache', async () => {
    const qc = client();
    await Promise.all([
      prefetchNavigationData(qc, user, '/customers'),
      prefetchNavigationData(qc, user, '/customers'),
    ]);
    expect(api.get).toHaveBeenCalledTimes(2);
    await qc.fetchQuery(
      customersQueryOptions({
        page: 1,
        pageSize: 10,
        search: undefined,
        accountState: undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    );
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.get).mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not request financial data without the corresponding permission/session', async () => {
    const qc = client();
    await prefetchNavigationData(qc, null, '/customers');
    await prefetchNavigationData(qc, { ...user, permissions: [] }, '/orders');
    await prefetchNavigationData(qc, { ...user, isSuperAdmin: true }, '/customers');
    await prefetchNavigationData(qc, user, '/customers/archive');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('refetches invalidated financial data rather than extending stale balances', async () => {
    const qc = client();
    await prefetchNavigationData(qc, user, '/orders?new=1');
    expect(api.get).toHaveBeenCalledTimes(2);
    await qc.invalidateQueries({ queryKey: ['orders'] });
    await prefetchNavigationData(qc, user, '/orders');
    expect(api.get).toHaveBeenCalledTimes(4);
  });
});
