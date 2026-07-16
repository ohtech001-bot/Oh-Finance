import type { LedgerEntry, LedgerListQuery, LedgerTotals, PaginatedResult } from '@oh/contracts';
type LedgerList = PaginatedResult<LedgerEntry> & {
    totals: LedgerTotals;
};
export declare function useLedger(query: Partial<LedgerListQuery>): import("@tanstack/react-query").UseQueryResult<NoInfer<LedgerList>, Error>;
export declare function useStatement(customerId: string | undefined, range?: {
    from?: string;
    to?: string;
}): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    entries: {
        id: string;
        seq: number;
        createdAt: string;
        notes: string | null;
        openingBalance: string;
        customerId: string;
        customerName: string;
        customerCode: string;
        entryType: "OPENING_BALANCE" | "ORDER_DEBIT" | "PAYMENT_CREDIT" | "ADJUSTMENT_DEBIT" | "ADJUSTMENT_CREDIT" | "REVERSAL" | "WRITE_OFF";
        debit: string;
        credit: string;
        runningBalance: string;
        refType: "CUSTOMER" | "ORDER" | "PAYMENT" | "ADJUSTMENT";
        refId: string | null;
        refNumber: string | null;
        reversesEntryId: string | null;
        isReversed: boolean;
        occurredAt: string;
        createdBy: string | null;
        createdByName: string | null;
    }[];
    from: string | null;
    to: string | null;
    openingBalance: string;
    customerId: string;
    customerName: string;
    customerCode: string;
    closingBalance: string;
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