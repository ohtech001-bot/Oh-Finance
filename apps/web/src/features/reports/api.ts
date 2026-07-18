import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ReportsData, ReportsQuery } from '@oh/contracts';
import { api, buildQuery } from '@/lib/api';

/**
 * بيانات التقارير — كلها من الخادم (مشتقة من قاعدة البيانات بمنطقة المحل).
 * المفتاح يشمل الفترة، فلكل فترة نسختها المخزّنة.
 */
export function useReports(query: Partial<ReportsQuery>) {
  return useQuery({
    queryKey: ['reports', query],
    queryFn: () => api.get<ReportsData>(`/reports${buildQuery(query as Record<string, string>)}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
