import type { ApplyCustomerCreditRequest, CreatePaymentRequest, PaginatedResult, PaymentListQuery } from '@oh/contracts';
export declare function usePayments(query: Partial<PaymentListQuery>, enabled?: boolean): import("@tanstack/react-query").UseQueryResult<NoInfer<PaginatedResult<{
    number: string;
    status: "POSTED" | "REVERSED";
    id: string;
    customerName: string;
    amount: string;
    createdAt: string;
    notes: string | null;
    customerId: string;
    customerCode: string;
    allocations: {
        amount: string;
        orderNumber: string;
        orderId: string;
        orderTotal: string;
    }[];
    paidAt: string;
    method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
    reference: string | null;
    balanceBefore: string;
    balanceAfter: string;
    unallocatedAmount: string;
    reversedAt: string | null;
    reverseReason: string | null;
    createdBy: string | null;
    createdByName: string | null;
}>>, Error>;
export declare function usePaymentStats(query: Partial<PaymentListQuery>): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    totalAmount: string;
    totalCount: number;
    byMethod: {
        CASH: {
            amount: string;
            count: number;
        };
        BANK_TRANSFER: {
            amount: string;
            count: number;
        };
        CARD: {
            amount: string;
            count: number;
        };
        CHECK: {
            amount: string;
            count: number;
        };
    };
    dailyAverage: string;
}>, Error>;
export declare function usePayment(id: string | undefined): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    number: string;
    status: "POSTED" | "REVERSED";
    id: string;
    customerName: string;
    amount: string;
    createdAt: string;
    notes: string | null;
    customerId: string;
    customerCode: string;
    allocations: {
        amount: string;
        orderNumber: string;
        orderId: string;
        orderTotal: string;
    }[];
    paidAt: string;
    method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
    reference: string | null;
    balanceBefore: string;
    balanceAfter: string;
    unallocatedAmount: string;
    reversedAt: string | null;
    reverseReason: string | null;
    createdBy: string | null;
    createdByName: string | null;
}>, Error>;
/**
 * تسجيل دفعة.
 *
 * ⚠️ ترويسة `Idempotency-Key` **إلزامية** — يولّدها المستدعي (crypto.randomUUID)
 *    مرة واحدة عند فتح النموذج، وتبقى ثابتة عبر إعادة المحاولة. هذا ما يمنع
 *    الدفعة المزدوجة عند بطء الشبكة أو نقرتين متسرعتين.
 */
export declare function useCreatePayment(): import("@tanstack/react-query").UseMutationResult<{
    number: string;
    status: "POSTED" | "REVERSED";
    id: string;
    customerName: string;
    amount: string;
    createdAt: string;
    notes: string | null;
    customerId: string;
    customerCode: string;
    allocations: {
        amount: string;
        orderNumber: string;
        orderId: string;
        orderTotal: string;
    }[];
    paidAt: string;
    method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
    reference: string | null;
    balanceBefore: string;
    balanceAfter: string;
    unallocatedAmount: string;
    reversedAt: string | null;
    reverseReason: string | null;
    createdBy: string | null;
    createdByName: string | null;
}, Error, {
    body: CreatePaymentRequest;
    idempotencyKey: string;
}, unknown>;
export declare function useCustomerCredit(customerId: string | undefined, enabled?: boolean): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    availableAmount: string;
}>, Error>;
export declare function useApplyCustomerCredit(): import("@tanstack/react-query").UseMutationResult<{
    status: "PARTIALLY_PAID" | "PAID";
    paidAmount: string;
    remainingAmount: string;
    orderId: string;
    appliedAmount: string;
}, Error, {
    body: ApplyCustomerCreditRequest;
    idempotencyKey: string;
}, unknown>;
export declare function useReversePayment(id: string): import("@tanstack/react-query").UseMutationResult<{
    number: string;
    status: "POSTED" | "REVERSED";
    id: string;
    customerName: string;
    amount: string;
    createdAt: string;
    notes: string | null;
    customerId: string;
    customerCode: string;
    allocations: {
        amount: string;
        orderNumber: string;
        orderId: string;
        orderTotal: string;
    }[];
    paidAt: string;
    method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
    reference: string | null;
    balanceBefore: string;
    balanceAfter: string;
    unallocatedAmount: string;
    reversedAt: string | null;
    reverseReason: string | null;
    createdBy: string | null;
    createdByName: string | null;
}, Error, {
    reason: string;
}, unknown>;
//# sourceMappingURL=api.d.ts.map