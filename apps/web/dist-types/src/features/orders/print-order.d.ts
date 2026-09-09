import type { OrderDetail } from '@oh/contracts';
import { type CurrencyCode } from '@oh/money';
interface PrintOrderOptions {
    store?: {
        name: string;
        logoUrl: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        taxEnabled: boolean;
        taxRate: number;
    } | null;
    customer?: {
        phone?: string | null;
        email?: string | null;
        city?: string | null;
        address?: string | null;
        balance?: string;
    } | null;
    payment?: {
        amount: string;
        balanceBefore: string;
        balanceAfter: string;
    } | null;
    paperSize?: PrintPaperSize;
    targetWindow?: Window | null;
}
export type PrintPaperSize = '80mm' | 'A4';
export declare function inclusiveTaxBreakdown(total: string, taxEnabled: boolean, taxRate: number, currency: CurrencyCode): {
    beforeTax: string;
    taxAmount: string;
};
export declare function orderSettlementDate(order: Pick<OrderDetail, 'remainingAmount' | 'allocations' | 'confirmedAt'>): Date | null;
export declare function formatOrderDate(value: string | Date): string;
export declare function formatOrderTime(value: string | Date): string;
export declare function printOrder(order: OrderDetail, currency: CurrencyCode, options?: PrintOrderOptions): void;
export {};
//# sourceMappingURL=print-order.d.ts.map