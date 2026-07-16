import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AllocationPreview,
  AllocationPreviewRequest,
  CreatePaymentRequest,
  OpenOrder,
  PaginatedResult,
  Payment,
  PaymentListQuery,
  PaymentStats,
  ReversePaymentRequest,
} from '@oh/contracts';
import { api, buildQuery } from '@/lib/api';

const KEY = 'payments';

export function usePayments(query: Partial<PaymentListQuery>) {
  return useQuery({
    queryKey: [KEY, 'list', query],
    queryFn: () =>
      api.get<PaginatedResult<Payment>>(`/payments${buildQuery(query as Record<string, string>)}`),
  });
}

export function usePaymentStats(query: Partial<PaymentListQuery>) {
  return useQuery({
    queryKey: [KEY, 'stats', query],
    queryFn: () =>
      api.get<PaymentStats>(`/payments/stats${buildQuery(query as Record<string, string>)}`),
  });
}

export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    queryFn: () => api.get<Payment>(`/payments/${id}`),
    enabled: Boolean(id),
  });
}

export function useOpenOrders(customerId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'open-orders', customerId],
    queryFn: () => api.get<OpenOrder[]>(`/payments/open-orders/${customerId}`),
    enabled: Boolean(customerId),
  });
}

/**
 * تسجيل دفعة.
 *
 * ⚠️ ترويسة `Idempotency-Key` **إلزامية** — يولّدها المستدعي (crypto.randomUUID)
 *    مرة واحدة عند فتح النموذج، وتبقى ثابتة عبر إعادة المحاولة. هذا ما يمنع
 *    الدفعة المزدوجة عند بطء الشبكة أو نقرتين متسرعتين.
 */
export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreatePaymentRequest; idempotencyKey: string }) =>
      api.post<Payment>('/payments', body, { idempotencyKey }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function usePreviewAllocation() {
  return useMutation({
    mutationFn: (body: AllocationPreviewRequest) =>
      api.post<AllocationPreview>('/payments/preview-allocation', body),
  });
}

export function useReversePayment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReversePaymentRequest) => api.post<Payment>(`/payments/${id}/reverse`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}
