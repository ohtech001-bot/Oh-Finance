import type { LedgerEntry, LedgerListQuery, LedgerTotals, PaginatedResult } from '@oh/contracts';
type LedgerList = PaginatedResult<LedgerEntry> & {
    totals: LedgerTotals;
};
export declare function useLedger(query: Partial<LedgerListQuery>): import("@tanstack/react-query").UseQueryResult<NoInfer<LedgerList>, Error>;
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
    entries: {
        id: string;
        seq: number;
        occurredAt: string;
        createdAt: string;
        notes: string | null;
        openingBalance: string;
        customerId: string;
        customerName: string;
        customerCode: string;
        createdBy: string | null;
        createdByName: string | null;
        entryType: "OPENING_BALANCE" | "ORDER_DEBIT" | "PAYMENT_CREDIT" | "ADJUSTMENT_DEBIT" | "ADJUSTMENT_CREDIT" | "REVERSAL" | "WRITE_OFF";
        debit: string;
        credit: string;
        runningBalance: string;
        refType: "ORDER" | "PAYMENT" | "CUSTOMER" | "ADJUSTMENT";
        refId: string | null;
        refNumber: string | null;
        reversesEntryId: string | null;
        isReversed: boolean;
    }[];
    from: string | null;
    to: string | null;
    openingBalance: string;
    customerId: string;
    customerName: string;
    customerCode: string;
    generatedAt: string;
    closingBalance: string;
    totals: {
        totalDebit: string;
        totalCredit: string;
        currentBalance: string;
        entryCount: number;
    };
}>, Error>;
export {};
//# sourceMappingURL=api.d.ts.map