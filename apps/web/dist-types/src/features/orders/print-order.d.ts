import type { OrderDetail } from '@oh/contracts';
import { type CurrencyCode } from '@oh/money';
interface PrintOrderOptions {
    store?: {
        name: string;
        logoUrl: string | null;
    } | null;
    targetWindow?: Window | null;
}
export declare function printOrder(order: OrderDetail, currency: CurrencyCode, options?: PrintOrderOptions): void;
export {};
//# sourceMappingURL=print-order.d.ts.map