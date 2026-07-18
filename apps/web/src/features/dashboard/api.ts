import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DashboardData, DashboardQuery } from '@oh/contracts';
import { api, buildQuery } from '@/lib/api';

/**
 * بيانات لوحة التحكم — كلها من الخادم (مشتقة من قاعدة البيانات، بمنطقة المحل).
 *
 * مفتاح الاستعلام يشمل الفترة والدقّة، فلكل فترة نسختها المخزّنة. `staleTime`
 * قصير: الأرقام المالية تتغيّر مع كل دفعة/طلب، فلا نعرض دَينًا سُدِّد للتو.
 */
export function useDashboard(query: Partial<DashboardQuery>) {
  return useQuery({
    queryKey: ['dashboard', query],
    queryFn: () =>
      api.get<DashboardData>(`/dashboard${buildQuery(query as Record<string, string>)}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
