import type { OrderDetail } from '@oh/contracts';
import { type CurrencyCode } from '@oh/money';
interface PrintOrderOptions {
    store?: {
        name: string;
        logoUrl: string | null;
        taxEnabled: boolean;
        taxRate: number;
    } | null;
    targetWindow?: Window | null;
}
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