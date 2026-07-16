import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCustomerRequest,
  Customer,
  CustomerListQuery,
  CustomerStats,
  CustomerSummary,
  PaginatedResult,
  UpdateCustomerRequest,
} from '@oh/contracts';
import { api, buildQuery } from '@/lib/api';

/**
 * خطاطيف الزبائن (TanStack Query).
 *
 * كل الأنواع من `@oh/contracts` — نفس عقود الخادم. لا تعريف مكرر، ولا انحراف
 * ممكن: تغيير حقل في العقد يكسر البناء هنا وعلى الخادم معًا.
 */

const KEY = 'customers';

export function useCustomers(query: Partial<CustomerListQuery>) {
  return useQuery({
    queryKey: [KEY, 'list', query],
    queryFn: () =>
      api.get<PaginatedResult<Customer>>(`/customers${buildQuery(query as Record<string, string>)}`),
  });
}

export function useCustomerStats() {
  return useQuery({
    queryKey: [KEY, 'stats'],
    queryFn: () => api.get<CustomerStats>('/customers/stats'),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    queryFn: () => api.get<Customer>(`/customers/${id}`),
    enabled: Boolean(id),
  });
}

export function useCustomerSummary(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'summary', id],
    queryFn: () => api.get<CustomerSummary>(`/customers/${id}/summary`),
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomerRequest) => api.post<Customer>('/customers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCustomerRequest) => api.patch<Customer>(`/customers/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useArchiveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
