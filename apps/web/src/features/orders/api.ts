import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CancelOrderRequest,
  ConfirmOrderRequest,
  CreateOrderRequest,
  Order,
  OrderDetail,
  OrderListQuery,
  OrderStats,
  OrderTotals,
  PaginatedResult,
} from '@oh/contracts';
import { api, buildQuery } from '@/lib/api';

const KEY = 'orders';

export function useOrders(query: Partial<OrderListQuery>) {
  return useQuery({
    queryKey: [KEY, 'list', query],
    queryFn: () =>
      api.get<PaginatedResult<Order>>(`/orders${buildQuery(query as Record<string, string>)}`),
  });
}

export function useOrderStats(query: Partial<OrderListQuery>) {
  return useQuery({
    queryKey: [KEY, 'stats', query],
    queryFn: () => api.get<OrderStats>(`/orders/stats${buildQuery(query as Record<string, string>)}`),
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    queryFn: () => api.get<OrderDetail>(`/orders/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderRequest) => api.post<OrderDetail>('/orders', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

/** معاينة حساب الطلب — الخادم يحسب، الواجهة تعرض. */
export function usePreviewOrder() {
  return useMutation({
    mutationFn: (body: { items: CreateOrderRequest['items']; discountAmount: string }) =>
      api.post<OrderTotals>('/orders/preview', body),
  });
}

export function useConfirmOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConfirmOrderRequest) => api.post<OrderDetail>(`/orders/${id}/confirm`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useCancelOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CancelOrderRequest) => api.post<OrderDetail>(`/orders/${id}/cancel`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}
