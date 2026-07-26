import type { Customer, CustomerStatement, OrderDetail, SessionUser } from '@oh/contracts';
import { type CurrencyCode } from '@oh/money';
import type { LocaleCode } from '@oh/config';
interface PrintCustomerStatementOptions {
    statement: CustomerStatement;
    customer: Customer;
    currency: CurrencyCode;
    locale: LocaleCode;
    store: SessionUser['store'];
    orders: OrderDetail[];
    targetWindow?: Window | null;
}
export declare function printCustomerStatement({ statement, customer, currency, locale, store, orders, targetWindow, }: PrintCustomerStatementOptions): void;
export {};
//# sourceMappingURL=print-customer-statement.d.ts.map