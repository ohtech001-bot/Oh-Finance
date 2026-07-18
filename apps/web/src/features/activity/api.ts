import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ActivityFilters, ActivityItem, PaginatedResult } from '@oh/contracts';
import { api, buildQuery } from '@/lib/api';

const KEY = 'activity';

/**
 * موجز نشاط المحل (store-wide). يتطلب صلاحية `activity.read` على الخادم —
 * فمرّر `enabled = can('activity.read')` حتى لا نطلق طلبًا يعود بـ403 لمن لا
 * يملكها.
 *
 * `keepPreviousData` يمنع وميض القائمة أثناء تنقّل الصفحات أو تغيير الفلتر.
 * `staleTime` قصير: النشاط يجب أن يبدو حيًّا.
 */
export function useStoreActivityFeed(filters: Partial<ActivityFilters>, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'store', filters],
    queryFn: () =>
      api.get<PaginatedResult<ActivityItem>>(
        `/activity${buildQuery(filters as Record<string, string>)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    enabled,
  });
}

/**
 * الخط الزمني لزبون. يتطلب `customers.read` للوصول؛ وتُرشَّح أنواع الأحداث
 * (طلبات/دفعات/حركات) على الخادم بحسب صلاحيات القراءة التفصيلية.
 */
export function useCustomerActivityFeed(
  customerId: string,
  filters: Partial<ActivityFilters>,
  enabled = true,
) {
  return useQuery({
    queryKey: [KEY, 'customer', customerId, filters],
    queryFn: () =>
      api.get<PaginatedResult<ActivityItem>>(
        `/customers/${customerId}/activity${buildQuery(filters as Record<string, string>)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    enabled: enabled && Boolean(customerId),
  });
}
