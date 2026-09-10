import type { LedgerEntry, LedgerListQuery, LedgerTotals, PaginatedResult } from '@oh/contracts';
type LedgerList = PaginatedResult<LedgerEntry> & {
    totals: LedgerTotals;
};
export declare function useLedger(query: Partial<LedgerListQuery>, enabled?: boolean): import("@tanstack/react-query").UseQueryResult<NoInfer<LedgerList>, Error>;
/**
 * يجمع **كل** حركات المرشّح الحالي عبر ترقيم الصفحات — للتصدير والطباعة.
 *
 * الجدول يعرض صفحة واحدة فقط، لكن التصدير يجب أن يشمل المجموعة المُرشَّحة
 * كاملة. نجمعها عند الطلب فقط (لا تُحمَّل مع كل عرض).
 */
export declare function fetchAllLedger(query: Partial<LedgerListQuery>): Promise<LedgerEntry[]>;
export declare function useStatement(customerId: string | undefined, range?: {
    from?: string;
    to?: string;
}): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    customerId: string;
    customerName: string;
    customerCode: string;
    openingBalance: string;
    entries: {
        id: string;
        seq: number;
        customerId: string;
        customerName: string;
        customerCode: string;
        entryType: "OPENING_BALANCE" | "ORDER_DEBIT" | "PAYMENT_CREDIT" | "ADJUSTMENT_DEBIT" | "ADJUSTMENT_CREDIT" | "REVERSAL" | "WRITE_OFF";
        openingBalance: string;
        debit: string;
        credit: string;
        runningBalance: string;
        refType: "CUSTOMER" | "ORDER" | "PAYMENT" | "ADJUSTMENT";
        refId: string | null;
        refNumber: string | null;
        relatedOrderNumbers: string[];
        reversesEntryId: string | null;
        isReversed: boolean;
        notes: string | null;
        occurredAt: string;
        createdAt: string;
        createdBy: string | null;
        createdByName: string | null;
    }[];
    from: string | null;
    to: string | null;
    closingBalance: string;
    orders: {
        orderId: string;
        paymentState: "PAID_FROM_CREDIT" | "PAID" | "PARTIALLY_PAID" | "UNPAID";
    }[];
    totals: {
        totalDebit: string;
        totalCredit: string;
        currentBalance: string;
        entryCount: number;
    };
    generatedAt: string;
}>, Error>;
export {};
//# sourceMappingURL=api.d.ts.map