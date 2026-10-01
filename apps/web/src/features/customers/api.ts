import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function customersQueryOptions(query: Partial<CustomerListQuery>) {
  return queryOptions({
    queryKey: [KEY, 'list', query],
    queryFn: ({ signal }) =>
      api.get<PaginatedResult<Customer>>(
        `/customers${buildQuery(query as Record<string, string>)}`,
        { signal },
      ),
  });
}

export function useCustomers(query: Partial<CustomerListQuery>) {
  return useQuery(customersQueryOptions(query));
}

export function customerStatsQueryOptions() {
  return queryOptions({
    queryKey: [KEY, 'stats'],
    queryFn: ({ signal }) => api.get<CustomerStats>('/customers/stats', { signal }),
  });
}

export function useCustomerStats() {
  return useQuery(customerStatsQueryOptions());
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    queryFn: ({ signal }) => api.get<Customer>(`/customers/${id}`, { signal }),
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
    onSuccess: () => invalidateCustomerScope(qc),
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCustomerRequest) => api.patch<Customer>(`/customers/${id}`, body),
    onSuccess: () => invalidateCustomerScope(qc),
  });
}

export function useArchiveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/customers/${id}`),
    onSuccess: () => invalidateCustomerScope(qc),
  });
}

export function useRestoreCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Customer>(`/customers/${id}/restore`, {}),
    onSuccess: () => invalidateCustomerScope(qc),
  });
}

function invalidateCustomerScope(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: [KEY] });
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
}
