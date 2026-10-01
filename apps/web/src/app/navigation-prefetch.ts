import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { SessionUser } from '@oh/contracts';
import { useAuth } from './auth-context';
import { prefetchRoute } from './route-prefetch';
import { customersQueryOptions, customerStatsQueryOptions } from '@/features/customers/api';
import { ordersQueryOptions, orderStatsQueryOptions } from '@/features/orders/api';

export async function prefetchNavigationData(
  client: QueryClient,
  user: SessionUser | null,
  path: string,
): Promise<void> {
  if (!user || user.isSuperAdmin) return;
  const pathname = path.split('?')[0];
  if (pathname === '/customers' && user.permissions.includes('customers.read')) {
    await Promise.all([
      client.prefetchQuery({
        ...customersQueryOptions({ page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
        retry: false,
      }),
      client.prefetchQuery({ ...customerStatsQueryOptions(), retry: false }),
    ]);
  } else if (pathname === '/orders' && user.permissions.includes('orders.read')) {
    await Promise.all([
      client.prefetchQuery({
        ...ordersQueryOptions({ page: 1, pageSize: 10, sortBy: 'issuedAt', sortOrder: 'desc' }),
        retry: false,
      }),
      client.prefetchQuery({ ...orderStatsQueryOptions({}), retry: false }),
    ]);
  }
}

export function useNavigationPrefetch() {
  const client = useQueryClient();
  const { user } = useAuth();
  return useCallback(
    (path: string) => {
      prefetchRoute(path);
      void prefetchNavigationData(client, user, path);
    },
    [client, user],
  );
}
