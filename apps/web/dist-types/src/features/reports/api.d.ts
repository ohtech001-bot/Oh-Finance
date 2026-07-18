import type { ReportsQuery } from '@oh/contracts';
/**
 * بيانات التقارير — كلها من الخادم (مشتقة من قاعدة البيانات بمنطقة المحل).
 * المفتاح يشمل الفترة، فلكل فترة نسختها المخزّنة.
 */
export declare function useReports(query: Partial<ReportsQuery>): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    kpis: {
        payments: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        sales: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        outstanding: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        ordersCount: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        activeCustomers: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        totalCustomers: number;
        averageOrderValue: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        taxes: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        discounts: {
            value: string;
            previous: string | null;
            deltaPct: number | null;
        };
        avgPaymentDurationDays: number | null;
    };
    topCustomers: {
        code: string;
        id: string;
        name: string;
        purchases: string;
    }[];
    meta: {
        currency: string;
        storeName: string;
        timezone: string;
        generatedAt: string;
        range: {
            from: string;
            to: string;
            preset: "custom" | "today" | "yesterday" | "last_7_days" | "last_30_days" | "this_month" | "previous_month" | "this_year";
            granularity: "day" | "week" | "month";
            previousFrom: string;
            previousTo: string;
            label: string;
        };
        scope: string[];
    };
    salesVsPayments: {
        date: string;
        payments: string;
        sales: string;
    }[];
    ordersByWeekday: {
        count: number;
        label: string;
        weekday: number;
    }[];
    ordersByStatus: {
        status: "CANCELLED" | "DRAFT" | "QUOTE" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID";
        amount: string;
        count: number;
    }[];
    paymentMethods: {
        method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHECK";
        amount: string;
        count: number;
        pct: number;
    }[];
    topProducts: {
        name: string;
        quantity: string;
        sales: string;
    }[];
    employeePerformance: {
        name: string;
        payments: string;
        orders: number;
        sales: string;
        userId: string | null;
    }[];
    salesByCategory: {
        reason: string;
        available: boolean;
    };
    branchReports: {
        reason: string;
        available: boolean;
    };
}>, Error>;
//# sourceMappingURL=api.d.ts.map