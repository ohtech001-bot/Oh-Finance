import { type CurrencyCode } from '@oh/money';
import { type KpiMetric, type TrendSeries } from '@oh/contracts';
export declare function CollectionRateChart({ metric }: {
    metric: KpiMetric;
}): import("react").JSX.Element;
/**
 * منحنى يجمع سلاسل مختارة على محور زمني واحد. السلاسل المالية تُنسّق كعملة،
 * والعددية كأرقام. يدمج النقاط حسب الدلو (bucket).
 */
export declare function TrendChart({ series, currency, height, emptyText, }: {
    series: TrendSeries[];
    currency: CurrencyCode;
    height?: number;
    emptyText?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=charts.d.ts.map