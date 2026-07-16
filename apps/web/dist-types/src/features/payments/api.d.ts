import type { CreatePaymentRequest, PaginatedResult, PaymentListQuery } from '@oh/contracts';
export declare function usePayments(query: Partial<PaymentListQuery>): import("@tanstack/react-query").UseQueryResult<NoInfer<PaginatedResult<{
    number: string;
    status: "POSTED" | "REVERSED";
    id: string;
    createdAt: string;
    notes: string | null;
    customerId: string;
    customerName: string;
    customerCode: string;
    allocations: {
        amount: string;
        orderId: string;
        orderNumber: string;
        orderTotal: string;
    }[];
    paidAt: string;
    method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
    amount: string;
    createdBy: string | null;
    createdByName: string | null;
    reference: string | null;
    balanceBefore: string;
    balanceAfter: string;
    unallocatedAmount: string;
    reversedAt: string | null;
    reverseReason: string | null;
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
    createdAt: string;
    notes: string | null;
    customerId: string;
    customerName: string;
    customerCode: string;
    allocations: {
        amount: string;
        orderId: string;
        orderNumber: string;
        orderTotal: string;
    }[];
    paidAt: string;
    method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
    amount: string;
    createdBy: string | null;
    createdByName: string | null;
    reference: string | null;
    balanceBefore: string;
    balanceAfter: string;
    unallocatedAmount: string;
    reversedAt: string | null;
    reverseReason: string | null;
}>, Error>;
export declare function useOpenOrders(customerId: string | undefined): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    number: string;
    total: string;
    id: string;
    issuedAt: string;
    dueAt: string | null;
    paidAmount: string;
    isOverdue: boolean;
    remaining: string;
}[]>, Error>;
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
    createdAt: string;
    notes: string | null;
    customerId: string;
    customerName: string;
    customerCode: string;
    allocations: {
        amount: string;
        orderId: string;
        orderNumber: string;
        orderTotal: string;
    }[];
    paidAt: string;
    method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
    amount: string;
    createdBy: string | null;
    createdByName: string | null;
    reference: string | null;
    balanceBefore: string;
    balanceAfter: string;
    unallocatedAmount: string;
    reversedAt: string | null;
    reverseReason: string | null;
}, Error, {
    body: CreatePaymentRequest;
    idempotencyKey: string;
}, unknown>;
export declare function usePreviewAllocation(): import("@tanstack/react-query").UseMutationResult<{
    allocations: {
        orderId: string;
        orderNumber: string;
        orderTotal: string;
        alreadyPaid: string;
        remaining: string;
        willAllocate: string;
        remainingAfter: string;
    }[];
    balanceBefore: string;
    balanceAfter: string;
    unallocatedAmount: string;
}, Error, {
    customerId: string;
    amount: string;
    strategy: "MANUAL" | "AUTO_OLDEST_FIRST" | "NONE";
}, unknown>;
export declare function useReversePayment(id: string): import("@tanstack/react-query").UseMutationResult<{
    number: string;
    status: "POSTED" | "REVERSED";
    id: string;
    createdAt: string;
    notes: string | null;
    customerId: string;
    customerName: string;
    customerCode: string;
    allocations: {
        amount: string;
        orderId: string;
        orderNumber: string;
        orderTotal: string;
    }[];
    paidAt: string;
    method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
    amount: string;
    createdBy: string | null;
    createdByName: string | null;
    reference: string | null;
    balanceBefore: string;
    balanceAfter: string;
    unallocatedAmount: string;
    reversedAt: string | null;
    reverseReason: string | null;
}, Error, {
    reason: string;
}, unknown>;
//# sourceMappingURL=api.d.ts.map