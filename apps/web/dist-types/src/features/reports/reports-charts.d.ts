import { type CurrencyCode } from '@oh/money';
import { type ReportsData } from '@oh/contracts';
export declare function SalesPaymentsLine({ data, currency }: {
    data: ReportsData['salesVsPayments'];
    currency: CurrencyCode;
}): import("react").JSX.Element;
export declare function WeekdayBars({ data }: {
    data: ReportsData['ordersByWeekday'];
}): import("react").JSX.Element;
export declare function PaymentMethodsDonut({ data, currency }: {
    data: ReportsData['paymentMethods'];
    currency: CurrencyCode;
}): import("react").JSX.Element;
//# sourceMappingURL=reports-charts.d.ts.map